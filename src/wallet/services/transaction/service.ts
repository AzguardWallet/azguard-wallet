import { TxHash, TxReceipt, TxStatus as AztecTxStatus } from "@aztec/stdlib/tx";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { AccountService, Account } from "@/wallet/services/account/service";
import { NetworkService } from "@/wallet/services/network/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { StepContent, WrappedTask } from "@/wallet/services/task/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { sleep } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Tx, TRANSACTION_SERVICE_NAME, TxOrigin, TxCall, TxStatus, Methods, Events } from "./spec";
import { AzguardFeePaymentMethod } from "../account/contracts";

export * from "./spec";

export class TransactionService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = TRANSACTION_SERVICE_NAME;

    public readonly onTransactionAdded = new EventHandler<Tx>();
    public readonly onTransactionUpdated = new EventHandler<Tx>();
    public readonly onTransactionDeleted = new EventHandler<Tx>();

    private readonly txs = new EntityStorage<Tx>("azguard:core:txs", StorageType.Local);
    private readonly pending = new Map<string, Tx>();

    private profileService: ProfileService = null!;
    private accountService: AccountService = null!;
    private networkService: NetworkService = null!;
    private worker?: Promise<void>;

    public constructor(logger: ILogger) {
        super(TRANSACTION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.accountService = services.get(AccountService.name);
        this.networkService = services.get(NetworkService.name);

        this.accountService.onAccountDeleted.add(this.onAccountDeleted);

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

    public async addTransaction(
        origin: TxOrigin,
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

    private groupPendingByNonce() {
        const groups = new Map<string, Tx[]>();

        for (const tx of this.pending.values()) {
            const key = `${tx.account}:${tx.nonce}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(tx);
        }

        return groups;
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

        const finalized = receipts.filter(r => r.receipt.status !== AztecTxStatus.PENDING);
        if (!finalized.length || finalized.length === receipts.length) {
            for (const r of receipts) {
                await this.applyReceipt(r.tx, r.receipt);
            }
            
            return;
        } else {
            const successful = finalized.find(r => r.receipt.status === AztecTxStatus.SUCCESS);
            if (successful) {
                for (const r of receipts) {
                    if (r.receipt.status === AztecTxStatus.PENDING) {
                        await this.updateTxStatus(r.tx, TxStatus.Cancelled);
                        this.pending.delete(r.tx.hash);
                    } else {
                        await this.applyReceipt(r.tx, r.receipt);
                    }
                }
            } else {
                for (const r of receipts) {
                    if (r.receipt.status === AztecTxStatus.PENDING && r.tx.status == TxStatus.Cancelling) {
                        await this.updateTxStatus(r.tx, TxStatus.Pending);
                    } else {
                        await this.applyReceipt(r.tx, r.receipt);
                    }
                }
            }
        }
    }

    private async applyReceipt(tx: Tx, receipt: TxReceipt) {
        const status = this.getTxStatus(receipt.status);
        if (status == TxStatus.Pending) {
            this.logDebug(`Tx ${tx.hash.slice(0, 8)} still ${TxStatus[tx.status]}`);
            return;
        }

        tx.updatedAt = Date.now();
        tx.status = status;
        tx.block =
            receipt.blockHash && receipt.blockNumber
                ? { hash: receipt.blockHash.toString(), number: receipt.blockNumber }
                : undefined;
        tx.fee = receipt.transactionFee?.toString();
        tx.error = receipt.error;

        await this.txs.set(tx.hash, tx);
        this.emit("onTransactionUpdated", tx);
        this.pending.delete(tx.hash);
        this.logDebug(`Tx ${tx.hash.slice(0, 8)} ${receipt.status}`);
    }

    public async updateTxStatus(tx: Tx, status: TxStatus) {
        if (tx.status != TxStatus.Pending && status == TxStatus.Cancelling) {
            throw new Error("Only pending transactions can be cancelled");
        }

        tx.updatedAt = Date.now();
        tx.status = status;

        await this.txs.set(tx.hash, tx);
        
        this.emit("onTransactionUpdated", tx);
        this.logDebug(`Tx ${tx.hash.slice(0, 8)} status updated to ${TxStatus[status]}`);
    }

    private getTxStatus(status: AztecTxStatus): TxStatus {
        switch (status) {
            case AztecTxStatus.PENDING:
                return TxStatus.Pending;
            case AztecTxStatus.DROPPED:
                return TxStatus.Dropped;
            case AztecTxStatus.SUCCESS:
                return TxStatus.Success;
            case AztecTxStatus.APP_LOGIC_REVERTED:
                return TxStatus.AppLogicReverted;
            case AztecTxStatus.TEARDOWN_REVERTED:
                return TxStatus.TeardownReverted;
            case AztecTxStatus.BOTH_REVERTED:
                return TxStatus.BothReverted;
            default:
                throw new Error("unknown tx status");
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
