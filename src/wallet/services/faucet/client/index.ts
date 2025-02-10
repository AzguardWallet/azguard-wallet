import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { MintRequest } from "./methods";

export * from './methods';

export const FAUCET_SERVICE_NAME = "faucet";

/**
 * Client for interaction with the FaucetService via messaging API
 */
export class FaucetServiceClient extends ServiceClient {
    /**
     * Creates FaucetServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
    ) {
        super(FAUCET_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Deploys token contract and mints tokens to the specified account.
     * @param network Network id.
     * @param account Account address.
     * @param name Token name.
     * @param symbol Token symbol.
     * @param decimals Token decimals.
     * @param amount Amount to mint.
     * @throws If transaction is invalid or failed.
     */
    public async mint(
        network: string,
        account: string,
        name: string,
        symbol: string,
        decimals: number,
        amount: number | bigint,
    ) {
        await this.request(new MintRequest(
            network,
            account,
            name,
            symbol,
            decimals,
            amount.toString(),
        ));
    }
}
