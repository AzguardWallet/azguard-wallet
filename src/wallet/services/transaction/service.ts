import { TxHash, TxStatus as AztecTxStatus } from "@aztec/stdlib/tx";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { AccountService, Account } from "@/wallet/services/account/service";
import { NetworkService } from "@/wallet/services/network/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { StepContent, WrappedTask } from "@/wallet/services/task/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { sleep } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Tx, TRANSACTION_SERVICE_NAME, TxOrigin, TxCall, TxStatus, Methods, Events } from "./spec";

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
        setup: TxCall[],
        isFeePayer: boolean,
        calls: TxCall[],
        nonce: string,
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
            setup,
            isFeePayer,
            calls,
            nonce,
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
                        await Promise.allSettled(this.pending.values().map(x => this.updateTx(x)));
                        const end = Date.now();
                        this.logDebug(`Transactions synced in ${end - start}ms`);
                    } catch (error) {
                        this.logError("Failed to sync transaction status.", error);
                    }
                }
            }
            await sleep(1000);
        }
    }

    private async updateTx(tx: Tx) {
        this.logDebug(`Sync tx ${tx.hash.slice(0, 8)}`);
        const node = await this.networkService.getNode(tx.chainId);
        if (!node) {
            this.logError("Unknown network");
            return;
        }

        const receipt = await node.getTxReceipt(TxHash.fromString(tx.hash));
        const status = this.getTxStatus(receipt.status);
        if (status === tx.status) {
            this.logDebug(`Tx ${tx.hash.slice(0, 8)} still ${receipt.status}`);
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
        if (tx.status != TxStatus.Pending) {
            this.pending.delete(tx.hash);
        }
        this.logDebug(`Tx ${tx.hash.slice(0, 8)} ${receipt.status}`);
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
}
