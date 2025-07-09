import { EventMessage } from "@/wallet/base/port-service/messages";
import { TokenBalanceInfo, TOKEN_BALANCE_SERVICE_NAME } from ".";

export enum TokenBalanceServiceEvent {
    TokenBalanceAdded,
    TokenBalanceUpdated,
    TokenBalanceDeleted,
}

export class TokenBalanceServiceEventMessage extends EventMessage {
    constructor(
        event: TokenBalanceServiceEvent,
        public readonly tokenBalance: TokenBalanceInfo
    ) {
        super(TOKEN_BALANCE_SERVICE_NAME, event);
    }
}