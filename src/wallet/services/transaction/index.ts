import { TxHash, TxStatus as AztecTxStatus } from "@aztec/stdlib/tx";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { AccountService } from "@/wallet/services/account";
import type { Account } from "@/wallet/services/account/client";
import type { NetworkService } from "@/wallet/services/network";
import type { ProfileService } from "@/wallet/services/profile"
import { type ILogs } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { sleep } from "@/wallet/utils";
import {
    type GetTransactionRequest,
    GetTransactionResponse,
    type GetTransactionsRequest,
    GetTransactionsResponse,
    Tx,
    TRANSACTION_SERVICE_NAME,
    TransactionServiceEvent,
    TransactionServiceEventMessage,
    TransactionServiceMethod,
    type TxOrigin,
    type TxCall,
    TxStatus,
    TxBlock,
} from "./client";
import { WrappedTask } from "../task";
import { StepContent } from "../task/client";

export class TransactionService extends Service {
    public readonly onTransactionAdded: ((tx: Tx) => void)[] = [];
    public readonly onTransactionUpdated: ((tx: Tx) => void)[] = [];

    private readonly txs: EntityStorage<Tx>;
    private readonly pending: Map<string, Tx> = new Map();
    private readonly worker: Promise<void>;

    constructor(
        private readonly profileService: ProfileService,
        private readonly accountService: AccountService,
        private readonly networkService: NetworkService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void,
    ) {
        super(TRANSACTION_SERVICE_NAME, logger, emit);
        this.txs = new EntityStorage("azguard:core:txs", StorageType.Local);
        this.accountService.onAccountDeleted.push(this.onAccountDeleted);

        this.worker = this.runWorker();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case TransactionServiceMethod.GetTransactions: {
                const _request = request as GetTransactionsRequest;
                try {
                    const txs = await this.getTransactions();
                    return new GetTransactionsResponse(_request, txs);
                }
                catch (error: any) {
                    return new GetTransactionsResponse(_request, undefined, error.message);
                }
            }
            case TransactionServiceMethod.GetTransaction: {
                const _request = request as GetTransactionRequest;
                try {
                    const tx = await this.getTransaction(_request.hash);
                    return new GetTransactionResponse(_request, tx);
                }
                catch (error: any) {
                    return new GetTransactionResponse(_request, undefined, error.message);
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async getTransactions(): Promise<Tx[]> {
        return this.txs.getValues();
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
        if ((await this.txs.get(hash))) {
            throw new Error("duplicated hash");
        }
        const now = Date.now();
        const tx = new Tx(
            origin,
            chainId,
            account,
            setup,
            isFeePayer,
            calls,
            nonce,
            hash,
            now,
            now,
            TxStatus.Pending,
        )
        await this.txs.set(tx.hash, tx);
        this.emit(new TransactionServiceEventMessage(TransactionServiceEvent.TransactionAdded, tx));
        for (const emit of this.onTransactionAdded) {
            try {emit(tx)} catch {}
        }
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
            this.emit(new TransactionServiceEventMessage(TransactionServiceEvent.TransactionDeleted, tx));
        }
    }

    private async init() {
        while(true) {
            try {
                for (const tx of (await this.txs.getValues()).filter(x => x.status === TxStatus.Pending)) {
                    this.pending.set(tx.hash, tx);
                }
                this.logDebug("Transaction service initialized");
                break;
            }
            catch (error) {
                this.logError("Failed to initialize transaction service. Retry...");
                await sleep(1000);
            }
        }
    }

    private async runWorker() {
        await this.init();
        while (true) {
            if (this.pending.size) {
                const activeProfile = await this.profileService.getActiveProfile();
                if (activeProfile) {
                    try {
                        this.logDebug(`Sync ${this.pending.size} transactions...`);
                        const start = Date.now();
                        await Promise.allSettled(
                            this.pending.values().map(x => this.updateTx(x)),
                        );
                        const end = Date.now();
                        this.logDebug(`Transactions synced in ${end - start}ms`);
                    }
                    catch (error) {
                        this.logError(["Failed to sync transaction status.", error]);
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
        tx.block = receipt.blockHash && receipt.blockNumber
            ? new TxBlock(receipt.blockHash.toString(), receipt.blockNumber)
            : undefined;
        tx.fee = receipt.transactionFee?.toString();
        tx.error = receipt.error;

        await this.txs.set(tx.hash, tx);
        this.emit(new TransactionServiceEventMessage(TransactionServiceEvent.TransactionUpdated, tx));
        for (const emit of this.onTransactionUpdated) {
            try {emit(tx)} catch {}
        }
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