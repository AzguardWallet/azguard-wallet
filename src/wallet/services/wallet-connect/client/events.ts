import { EventMessage } from "@/wallet/base/messages";
import { Network, WALLET_CONNECT_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum WalletConnectServiceEvent {
    DappConnected,
}

export class WalletConnectServiceEventMessage extends EventMessage {
    constructor(
        event: WalletConnectServiceEvent,
        // public readonly network: Network
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, event);
    }
}