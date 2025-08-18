import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import {
    ConnectByURIRequest,
} from "./methods";

export * from './methods';

export const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

/**
 * Client for interaction with external services via messaging API
 */
export class WalletConnectServiceClient extends ServiceClient {
    /**
     * Creates WalletConnectServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, new LoggerServiceClient(), onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        this.logError(`Unexpected event type ${message.event}.`);
    }

    /**
     * Calls for pairing in the WalletConnect network.
     * @param uri WalletConnect connection uri.
     */
    public connectByURI(uri: string): Promise<void> {
        return this.request(new ConnectByURIRequest(uri));
    }
}
