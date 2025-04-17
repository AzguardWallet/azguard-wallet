import { EventMessage } from "@/wallet/base/messages";
import { ACCOUNT_STATE_SERVICE_NAME } from ".";

export enum AccountStateServiceEvent {
    SenderAdded,
    SenderDeleted,
}

export class AccountStateServiceEventMessage extends EventMessage {
    constructor(
        event: AccountStateServiceEvent,
        public readonly sender: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, event);
    }
}
