import { TxExecutionResult as AztecTxExecutionResult, TxHash, TxStatus as AztecTxStatus } from "@aztec/stdlib/tx";
import type { TxReceipt } from "@aztec/stdlib/tx";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { AztecNode } from "@aztec/stdlib/interfaces/client";
import { FunctionSelector } from "@aztec/stdlib/abi";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { AccountService, Account, AccountType } from "@/wallet/services/account/service";
import { NetworkService } from "@/wallet/services/network/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { IPXE, PxeServiceClient } from "@/wallet/services/pxe/client";
import { TaskService, StepContent, WrappedTask } from "@/wallet/services/task/service";
import { TransactionSyncContent } from "@/wallet/services/task/spec";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { sleep } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { EventHandler } from "@/wallet/utils/event-handler";
import { PrivateEventFilter } from "@aztec/aztec.js/wallet";
import { BlockNumber } from "@aztec/foundation/branded-types";
import { Tx, SyncedTx, TxIndexerCursor, TRANSACTION_SERVICE_NAME, LocalTxOrigin, TxCall, SyncedTxCall, TxStatus, TxExecutionResult, Methods, Events, OriginType, isSyncedTx } from "./spec";
import { AzguardFeePaymentMethod } from "../account/contracts";
import { FUNCTION_CALL_LOG_EVENT_SELECTOR } from "../account/contracts/azguard-v0-persistent";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/curves/bn254";
import type { ContractInstanceWithAddress } from "@aztec/stdlib/contract";

export * from "./spec";

/** Number of blocks fetched per batch during transaction history sync. */
const SYNC_BATCH_SIZE = 200_000;
/** Pause (ms) between sync batches to reduce PXE/node load. */
const SYNC_BATCH_PAUSE_MS = 1000;

/** Session-scoped caches for sync operation */
type SyncCaches = {
    /** contractAddress -> ContractInstanceWithAddress */
    contractInstances: Map<string, ContractInstanceWithAddress | undefined>;
    /** classId -> (selector -> methodName) */
    selectorMap: Map<string, Map<string, string>>;
    /** txHash -> TxReceipt */
    txReceipts: Map<string, TxReceipt>;
};

export type FunctionCallLogEvent = {
    sender: AztecAddress;
    address: AztecAddress;
    args_hash: Fr;
    nonce: Fr;
    callIndex: number;
    selector: FunctionSelector;
    isPublic: boolean;
    isStatic: boolean;
    hideSender: boolean;
    feePaymentMethod: AzguardFeePaymentMethod;
};

export class TransactionService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = TRANSACTION_SERVICE_NAME;

    public readonly onTransactionAdded = new EventHandler<Tx>();
    public readonly onTransactionUpdated = new EventHandler<Tx>();
    public readonly onTransactionDeleted = new EventHandler<Tx>();

    private readonly txs = new EntityStorage<Tx>("azguard:core:txs", StorageType.Local);
    private readonly cursors = new EntityStorage<TxIndexerCursor>("azguard:core:tx-cursors", StorageType.Local);
    private readonly pending = new Map<string, Tx>();
    private readonly syncingAccounts = new Map<string, string>(); // account address -> task id

    private profileService: ProfileService = null!;
    private accountService: AccountService = null!;
    private networkService: NetworkService = null!;
    private pxeService: PxeServiceClient = null!;
    private taskService: TaskService = null!;
    private worker?: Promise<void>;

    public constructor(logger: ILogger) {
        super(TRANSACTION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.accountService = services.get(AccountService.name);
        this.networkService = services.get(NetworkService.name);
        this.taskService = services.get(TaskService.name);
        this.pxeService = new PxeServiceClient(this.logger);

        this.accountService.onAccountDeleted.add(this.onAccountDeleted);
        this.accountService.onAccountAdded.add(this.onAccountAdded);
        this.profileService.onActiveProfileChanged.add(this.onActiveProfileChanged);

        for (const tx of (await this.txs.getValues()).filter(x => x.status === TxStatus.Pending)) {
            this.pending.set(tx.hash, tx);
        }

        this.worker = this.runWorker();
    }

    public async getTransactions(account: string): Promise<Tx[]> {
        return (await this.txs.getValues()).filter(x => x.account === account);
    }

    public async getTransaction(hash: string): Promise<Tx> {
        const tx = await this.txs.get(hash);
        if (!tx) {
            throw new Error("unknown hash");
        }
        return tx;
    }

    public async getTxSyncCursor(address: string): Promise<TxIndexerCursor | null> {
        return (await this.cursors.get(address)) ?? null;
    }

    public async addTransaction(
        origin: LocalTxOrigin,
        chainId: number,
        account: string,
        calls: TxCall[],
        nonce: string,
        feePaymentMethod: AzguardFeePaymentMethod,
        hash: string,
    ): Promise<Tx> {
        if (await this.txs.get(hash)) {
            throw new Error("duplicated hash");
        }
        const now = Date.now();
        const tx: Tx = {
            origin,
            chainId,
            account,
            calls,
            nonce,
            feePaymentMethod,
            hash,
            createdAt: now,
            updatedAt: now,
            status: TxStatus.Pending,
        };
        await this.txs.set(tx.hash, tx);
        this.emit("onTransactionAdded", tx);
        this.pending.set(tx.hash, tx);
        return tx;
    }

    public async waitForTx(txHash: string, parentTask?: WrappedTask) {
        const waitForTxTask = parentTask?.startSubtask(new StepContent("Waiting for transaction"));
        while (this.pending.has(txHash)) {
            await sleep(100);
        }
        waitForTxTask?.complete();
    }

    private readonly onAccountDeleted = async (account: Account) => {
        this.logDebug(`Account ${account.address} deleted, remove related txs`);
        for (const tx of (await this.txs.getValues()).filter(x => x.account === account.address)) {
            this.logDebug(`Remove tx ${tx.hash}`);
            this.pending.delete(tx.hash);
            await this.txs.delete(tx.hash);
            this.emit("onTransactionDeleted", tx);
        }
        await this.cursors.delete(account.address);
    };

    private readonly onAccountAdded = async (account: Account) => {
        if (account.type === AccountType.Azguard_v0_persistent) {
            await this.syncTransactionHistory(account.chainId, account.address);
        }
    };

    private readonly onActiveProfileChanged = async () => {
        // Resume incomplete syncs (cursors where updatedAt is null - never finished)
        for (const cursor of await this.cursors.getValues()) {
            if (cursor.updatedAt === null) {
                this.logInfo(`Resuming incomplete sync for account=${cursor.account}`);
                await this.syncTransactionHistory(cursor.chainId, cursor.account);
            }
        }
    };

    private async runWorker() {
        while (true) {
            if (this.pending.size) {
                const activeProfile = await this.profileService.getActiveProfile();
                if (activeProfile) {
                    try {
                        this.logDebug(`Sync ${this.pending.size} transactions...`);
                        const start = Date.now();
                        
                        const groups = this.groupPendingByNonce();
                        const tasks: Promise<void>[] = [];

                        for (const txs of groups.values()) {
                            tasks.push(this.updateTxGroup(txs));
                        }

                        await Promise.allSettled(tasks);

                        const end = Date.now();
                        this.logDebug(`Transactions synced in ${end - start}ms`);
                    } catch (error) {
                        this.logError("Failed to sync transaction status.", getErrorMessage(error));
                    }
                }
            }
            await sleep(1000);
        }
    }

    private parsePackedEvent(ev: PackedPrivateEvent): FunctionCallLogEvent {
        const event = {
            sender: AztecAddress.fromFieldUnsafe(ev.packedEvent[0]),
            address: AztecAddress.fromFieldUnsafe(ev.packedEvent[1]),
            args_hash: ev.packedEvent[2],
            nonce: ev.packedEvent[3],
            callIndex: ev.packedEvent[4].toNumber(),
            selector: FunctionSelector.fromField(ev.packedEvent[5]),
            isPublic: ev.packedEvent[6].toBool(),
            isStatic: ev.packedEvent[7].toBool(),
            hideSender: ev.packedEvent[8].toBool(),
            feePaymentMethod: ev.packedEvent[9].toNumber(),
        };
        this.logDebug(`Indexer: parsed event=${JSON.stringify(event)}`);
        return event;
    }

    private async processFnCallEvent(
        account: Account,
        node: AztecNode,
        pxe: IPXE,
        ev: PackedPrivateEvent,
        caches: SyncCaches,
    ): Promise<void> {
        try {
            const event = this.parsePackedEvent(ev);
            const accountAddress = AztecAddress.fromStringUnsafe(account.address);
            const txHash = ev.txHash.toString();

            const existingTx = await this.txs.get(txHash);
            const call = await this.buildSyncedTxCall(pxe, event, accountAddress, existingTx, caches);

            if (existingTx) {
                if (isSyncedTx(existingTx)) {
                    const isDuplicate = existingTx.calls.some(
                        c => c.chunkNonce === call.chunkNonce && c.callIndex === call.callIndex,
                    );
                    if (isDuplicate) {
                        this.logDebug(
                            `Sync: call already added tx=${txHash} chunkNonce=${call.chunkNonce} callIndex=${call.callIndex}, skipping`,
                        );
                        return;
                    }
                    existingTx.calls.push(call);
                    existingTx.updatedAt = Date.now();
                    await this.txs.set(existingTx.hash, existingTx);
                    this.emit("onTransactionUpdated", existingTx);
                    this.logDebug(`Sync: added call to tx=${txHash} calls=${existingTx.calls.length}`);
                } else {
                    this.logDebug(`Sync: skip existing tx=${txHash} origin=${existingTx.origin.type}`);
                }
                return;
            }

            // New Tx - first event's nonce is the root nonce
            const block = await node.getBlock(ev.l2BlockNumber);
            if (!block) {
                this.logError(`Sync: block ${ev.l2BlockNumber} not found`);
                return;
            }

            // Fetch receipt from node to get real status and execution result
            let receipt = caches.txReceipts.get(txHash);
            if (!receipt) {
                receipt = await node.getTxReceipt(TxHash.fromString(txHash));
                caches.txReceipts.set(txHash, receipt);
            }

            const newTx: SyncedTx = {
                origin: { type: OriginType.Synced, name: "Sync" },
                chainId: account.chainId,
                account: account.address,
                calls: [call],
                nonce: event.nonce.toString(),
                feePaymentMethod: event.feePaymentMethod,
                hash: txHash,
                createdAt: Number(block.header.globalVariables.timestamp) * 1000,
                updatedAt: Date.now(),
                status: this.getTxStatus(receipt.status),
                executionResult: this.getTxExecutionResult(receipt.executionResult),
                block: { hash: ev.l2BlockHash.toString(), number: ev.l2BlockNumber },
                fee: receipt.transactionFee?.toString(),
                error: receipt.error,
            };

            await this.txs.set(newTx.hash, newTx);
            this.emit("onTransactionAdded", newTx);
            this.logInfo(`Sync: account=${account.address} added tx=${txHash} block=${ev.l2BlockNumber}`);
        } catch (error) {
            this.logError("Sync: failed to process event", getErrorMessage(error));
        }
    }

    private async buildSyncedTxCall(
        pxe: IPXE,
        event: FunctionCallLogEvent,
        accountAddress: AztecAddress,
        existingTx: Tx | undefined,
        caches: SyncCaches,
    ): Promise<SyncedTxCall> {
        const methodName = await this.resolveMethodName(pxe, event.address.toString(), event.selector.toString(), caches);
        const eventNonce = event.nonce.toString();

        // isBatch: call targets the account contract itself (internal chunked execute)
        const isBatch = event.address.equals(accountAddress);

        // chunkNonce: only set when this call belongs to a chunked batch (nonce differs from root)
        const chunkNonce = existingTx && eventNonce !== existingTx.nonce ? eventNonce : undefined;

        return {
            contract: event.address.toString(),
            selector: event.selector.toString(),
            argsHash: event.args_hash.toString(),
            method: methodName ?? undefined,
            callIndex: event.callIndex,
            chunkNonce,
            isBatch: isBatch || undefined,
        };
    }

    private async resolveMethodName(
        pxe: IPXE,
        contractAddress: string,
        selector: string,
        caches: SyncCaches,
    ): Promise<string | null> {
        try {
            // Check contract instance cache
            let contractInstance: ContractInstanceWithAddress | undefined;
            if (caches.contractInstances.has(contractAddress)) {
                contractInstance = caches.contractInstances.get(contractAddress);
            } else {
                const address = AztecAddress.fromStringUnsafe(contractAddress);
                contractInstance = await pxe.getContractInstance(address);
                caches.contractInstances.set(contractAddress, contractInstance);
            }

            if (!contractInstance) {
                this.logDebug(`resolveMethodName: no contractInstance for ${contractAddress}`);
                return null;
            }

            const classId = contractInstance.currentContractClassId.toString();

            // Check selector map cache for this class
            let selectorMap = caches.selectorMap.get(classId);
            if (!selectorMap) {
                selectorMap = new Map();
                caches.selectorMap.set(classId, selectorMap);

                // Build selector -> methodName map for this class
                const artifact = await pxe.getContractArtifact(
                    contractInstance.currentContractClassId,
                );
                if (!artifact) {
                    this.logDebug(`resolveMethodName: no artifact for classId=${classId}`);
                    return null;
                }

                const functions = artifact.functions ?? [];
                const nonDispatchFunctions = artifact.nonDispatchPublicFunctions ?? [];
                const allFunctions = [...functions, ...nonDispatchFunctions];

                for (const fn of allFunctions) {
                    const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                    selectorMap.set(fnSelector.toString(), fn.name);
                }

                this.logDebug(`resolveMethodName: built selector map for classId=${classId} with ${selectorMap.size} entries`);
            }

            const methodName = selectorMap.get(selector);
            if (!methodName) {
                this.logDebug(`resolveMethodName: no match for selector ${selector} in classId=${classId}`);
            }
            return methodName ?? null;
        } catch (error) {
            this.logDebug(`Failed to resolve method name for ${contractAddress}: ${getErrorMessage(error)}`);
            return null;
        }
    }

    /**
     * Synchronizes transaction history for a persistent account.
     * Can be called on account creation or manually to refresh history.
     * PXE handles incremental sync internally via sliding window on tagging indexes.
     * @param chainId Chain ID of the network.
     * @param address Account address to sync.
     */
    public async syncTransactionHistory(chainId: number, address: string): Promise<void> {
        // Skip if already syncing this account
        if (this.syncingAccounts.has(address)) {
            this.logDebug(`Sync: already syncing account=${address}, skipping`);
            return;
        }

        // Look up profile, network, and account
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            this.logError("Sync: no active profile");
            return;
        }
        const networks = await this.networkService.getNetworks(chainId);
        const network = networks.find(n => n.isDefault) ?? networks.at(0);
        if (!network) {
            this.logError(`Sync: network not found for chainId=${chainId}`);
            return;
        }
        const account = await this.accountService.getAccount(profile.id, chainId, address);
        if (!account) {
            this.logError(`Sync: account not found for address=${address}`);
            return;
        }
        if (account.type !== AccountType.Azguard_v0_persistent) {
            this.logDebug(`Sync: account ${address} is not persistent, skipping`);
            return;
        }

        const task = this.taskService.startNewTask(new TransactionSyncContent(address));
        this.syncingAccounts.set(address, task.id);

        try {
            this.logInfo(`Sync: starting for account=${address}`);

            let cursor: TxIndexerCursor = (await this.cursors.get(address)) ?? {
                account: address,
                chainId,
                head: 1,
                updatedAt: null,
            };

            // Persist immediately so onActiveProfileChanged can resume if we crash before the first batch
            await this.cursors.set(address, cursor);
            const node = await this.networkService.getNode(account.chainId);
            const contractAddress = AztecAddress.fromStringUnsafe(address);

            // Ensure account contract is registered with PXE before querying private events
            // TODO: consider moving this logic to the IAccountContract interface
            const pxe = this.pxeService.getPXE(network);
            const accountContract = await this.accountService.getAccountContract(
                account.profileId,
                account.chainId,
                address,
            );
            await accountContract.ensureRegistered(pxe);
            await accountContract.ensureContractRegistered(pxe);

            const tip = await node.getBlockNumber();

            // Session-scoped caches to avoid redundant metadata fetches and selector computations
            const caches: SyncCaches = {
                contractInstances: new Map(),
                selectorMap: new Map(),
                txReceipts: new Map(),
            };

            while (cursor.head <= tip) {
                const endExclusive = Math.min(cursor.head + SYNC_BATCH_SIZE, tip + 1);
                const filter: PrivateEventFilter = {
                    contractAddress,
                    scopes: [contractAddress],
                    fromBlock: BlockNumber(cursor.head),
                    toBlock: BlockNumber(endExclusive),
                };

                const start = Date.now();
                const events = await this.pxeService.getPrivateEvents(
                    network,
                    FUNCTION_CALL_LOG_EVENT_SELECTOR,
                    filter,
                );
                const duration = Date.now() - start;

                this.logDebug(
                    `Sync: account=${address} blocks=${cursor.head}-${endExclusive - 1} events=${events.length} time=${duration}ms`,
                );

                for (const ev of events) {
                    await this.processFnCallEvent(account, node, pxe, ev, caches);
                }

                cursor.head = endExclusive;
                await this.cursors.set(address, cursor);

                if (cursor.head <= tip) {
                    await sleep(SYNC_BATCH_PAUSE_MS);
                }
            }

            cursor.updatedAt = Date.now();
            await this.cursors.set(address, cursor);

            this.taskService.completeTask(task.id);
            this.logInfo(`Sync: completed for account=${address}`);
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError(`Sync: failed for account=${address}`, errorMessage);
            this.taskService.failTask(task.id, errorMessage);
        } finally {
            this.syncingAccounts.delete(address);
        }
    }

    private groupPendingByNonce() {
        const groups = new Map<string, Tx[]>();

        for (const tx of this.pending.values()) {
            const key = `${tx.account}:${tx.nonce}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(tx);
        }

        return groups;
    }

    private isFinalized(r: TxReceipt) {
        return (![AztecTxStatus.PENDING, AztecTxStatus.PROPOSED].includes(r.status))
    }

    private async updateTxGroup(txs: Tx[]) {
        const node = await this.networkService.getNode(txs[0].chainId);
        if (!node) {
            this.logError("Unknown network");
            return;
        }

        const receipts = await Promise.all(
            txs.map(tx => {
                this.logDebug(`Sync tx ${tx.hash.slice(0, 8)}`);
                
                return node.getTxReceipt(TxHash.fromString(tx.hash))
                    .then(r => ({ tx, receipt: r }))
                }
            )
        );
        
        const finalized = receipts.filter(r => this.isFinalized(r.receipt));

        if (!finalized.length || finalized.length === receipts.length) {
            for (const r of receipts) {
                await this.applyReceipt(r.tx, r.receipt);
            }
            
            return;
        } else {
            const dropped = finalized.some(r => r.receipt.status === AztecTxStatus.DROPPED);
            if (dropped) {
                for (const r of receipts) {
                    if (r.receipt.status === AztecTxStatus.PENDING && r.tx.status == TxStatus.Cancelling) {
                        await this.updateTxStatus(r.tx, TxStatus.Pending);
                    } else {
                        await this.applyReceipt(r.tx, r.receipt);
                    }
                }
            } else {
                for (const r of receipts) {
                    if (r.receipt.status === AztecTxStatus.PENDING) {
                        await this.updateTxStatus(r.tx, TxStatus.Cancelled);
                        this.pending.delete(r.tx.hash);
                    } else {
                        await this.applyReceipt(r.tx, r.receipt);
                    }
                }
            }
        }
    }

    private async applyReceipt(tx: Tx, receipt: TxReceipt) {
        const status = this.getTxStatus(receipt.status);
        const executionResult = this.getTxExecutionResult(receipt.executionResult);
        const _tx = await this.txs.get(tx.hash);
        if (status == _tx?.status) {
            this.logDebug(`Tx ${tx.hash.slice(0, 8)} still ${TxStatus[tx.status]}`);
            return;
        }

        tx.updatedAt = Date.now();
        tx.status = status;
        tx.executionResult = executionResult;
        tx.block =
            receipt.blockHash && receipt.blockNumber
                ? { hash: receipt.blockHash.toString(), number: receipt.blockNumber }
                : undefined;
        tx.fee = receipt.transactionFee?.toString();
        tx.error = receipt.error;

        await this.txs.set(tx.hash, tx);
        this.emit("onTransactionUpdated", tx);
        if (this.isFinalized(receipt)) {
            this.pending.delete(tx.hash);
        }
        
        this.logDebug(`Tx ${tx.hash.slice(0, 8)} ${receipt.status}`);
    }

    public async updateTxStatus(tx: Tx, status: TxStatus) {
        const current = await this.txs.get(tx.hash);  
        if (!current) {
            throw new Error("Transaction not found in storage");
        }

        if (current.status != TxStatus.Pending && status == TxStatus.Cancelling) {
            throw new Error("Only pending transactions can be cancelled");
        }

        current.updatedAt = Date.now();
        current.status = status;

        await this.txs.set(current.hash, current);
        
        this.emit("onTransactionUpdated", current);
        this.logDebug(`Tx ${current.hash.slice(0, 8)} status updated to ${TxStatus[status]}`);
    }

    private getTxStatus(status: AztecTxStatus): TxStatus {
        switch (status) {
            case AztecTxStatus.PENDING:
                return TxStatus.Pending;
            case AztecTxStatus.DROPPED:
                return TxStatus.Dropped;
            case AztecTxStatus.PROPOSED:
                return TxStatus.Proposed;
            case AztecTxStatus.CHECKPOINTED:
                return TxStatus.Checkpointed;
            case AztecTxStatus.PROVEN:
                return TxStatus.Proven;
            case AztecTxStatus.FINALIZED:
                return TxStatus.Finalized;
            default:
                throw new Error("unknown tx status");
        }
    }

    private getTxExecutionResult(result: AztecTxExecutionResult | undefined): TxExecutionResult | undefined {
        if (!result) return undefined;
        switch (result) {
            case AztecTxExecutionResult.SUCCESS:
                return TxExecutionResult.Success;
            case AztecTxExecutionResult.REVERTED:
                return TxExecutionResult.Reverted;
            default:
                return undefined;
        }
    }

    public async backup(): Promise<Tx[] | undefined> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        const networks = (await this.networkService.getNetworks());
        if (!networks.length) {
            return undefined;
        }

        const txs: Tx[] = [];

        for (const n of networks) {
            const accounts = await this.accountService.getAccounts(profile.id, n.chainId);
            for (const acc of accounts) {
                txs.push(...(await this.getTransactions(acc.address)));
            }
        }

        return txs;
    }

    public async restore(txs: Tx[]): Promise<Restored<Tx>[]> {
        await this.ensureInitialized();

        const result: Restored<Tx>[] = [];

        for (const tx of txs) {
            try {
                await this.txs.set(tx.hash, tx);
                
                result.push(tx);
                if (tx.status !== TxStatus.Pending) continue;

                this.pending.set(tx.hash, tx);
            } catch (err) {
                result.push({
                    ...tx,
                    restoreError: err instanceof Error ? err.message : err,
                });
            }
        }

        return result;
    }
}
