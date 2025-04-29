import { EventMessage } from "@/wallet/base/port-service/messages";
import { TokenInfo, TOKEN_SERVICE_NAME } from ".";

export enum TokenServiceEvent {
    TokenAdded,
    TokenUpdated,
    TokenDeleted,
}

export class TokenServiceEventMessage extends EventMessage {
    constructor(
        event: TokenServiceEvent,
        public readonly token: TokenInfo
    ) {
        super(TOKEN_SERVICE_NAME, event);
    }
}