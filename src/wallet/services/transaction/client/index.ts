import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { TransactionServiceEvent, type TransactionServiceEventMessage } from "./events";
import type { Tx } from "./models";
import {
    GetTransactionRequest,
    GetTransactionsRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const TRANSACTION_SERVICE_NAME = "transaction";

/**
 * Client for interaction with the TransactionService via messaging API
 */
export class TransactionServiceClient extends ServiceClient {
    /**
     * Creates TransactionServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onTransactionAdded Callback, called when a new transaction was created.
     * @param onTransactionUpdated Callback, called when an existing transaction was updated.
     * @param onTransactionDeleted Callback, called when an existing transaction was updated.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onTransactionAdded?: (tx: Tx) => void,
        private readonly onTransactionUpdated?: (tx: Tx) => void,
        private readonly onTransactionDeleted?: (tx: Tx) => void,
    ) {
        super(TRANSACTION_SERVICE_NAME, new LoggerServiceClient(), onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case TransactionServiceEvent.TransactionAdded:
                if (this.onTransactionAdded) {
                    try {this.onTransactionAdded((message as TransactionServiceEventMessage).tx);}
                    catch {}
                }
                break;
            case TransactionServiceEvent.TransactionUpdated:
                if (this.onTransactionUpdated) {
                    try {this.onTransactionUpdated((message as TransactionServiceEventMessage).tx);}
                    catch {}
                }
                break;
            case TransactionServiceEvent.TransactionDeleted:
                if (this.onTransactionDeleted) {
                    try {this.onTransactionDeleted((message as TransactionServiceEventMessage).tx);}
                    catch {}
                }
                break;
            default:
                this.logError(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of transactions.
     */
    public getTransactions(account: string): Promise<Tx[]> {
        return this.request(new GetTransactionsRequest(account));
    }

    /**
     * Returns a transaction with the specified hash.
     * @param hash Transaction hash.
     * @throws If the transaction with the specified hash doesn't exist.
     */
    public getTransaction(hash: string): Promise<Tx> {
        return this.request(new GetTransactionRequest(hash));
    }
}
