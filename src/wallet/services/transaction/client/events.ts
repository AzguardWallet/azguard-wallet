import { EventMessage } from "@/wallet/base/port-service/messages";
import { Tx, TRANSACTION_SERVICE_NAME } from ".";

export enum TransactionServiceEvent {
    TransactionAdded,
    TransactionUpdated,
    TransactionDeleted,
}

export class TransactionServiceEventMessage extends EventMessage {
    constructor(
        event: TransactionServiceEvent,
        public readonly tx: Tx
    ) {
        super(TRANSACTION_SERVICE_NAME, event);
    }
}