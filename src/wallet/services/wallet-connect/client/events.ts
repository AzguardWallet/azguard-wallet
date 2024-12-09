import { EventMessage } from "@/wallet/base/messages";
import { WALLET_CONNECT_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum WalletConnectServiceEvent {
    ProposalExpire,
    RequestExpire,
}

export class WalletConnectServiceEventMessage extends EventMessage {
    constructor(
        event: WalletConnectServiceEvent,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload?: any,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, event);
    }
}