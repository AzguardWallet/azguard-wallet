import { EventMessage } from "@/wallet/base/port-service/messages";
import { Account, ACCOUNT_SERVICE_NAME } from ".";

export enum AccountServiceEvent {
    AccountAdded,
    AccountUpdated,
    AccountDeleted,
}

export class AccountServiceEventMessage extends EventMessage {
    constructor(
        event: AccountServiceEvent,
        public readonly account: Account
    ) {
        super(ACCOUNT_SERVICE_NAME, event);
    }
}