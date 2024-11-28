import type { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { WalletConnectServiceEvent, type WalletConnectServiceEventMessage } from "./events";
import {
    ConnectByURIRequest,
    ApproveDappSessionRequest,
    RejectDappSessionRequest,
    DropDappSessionRequest,
    ValidateProposalRequest,
} from "./methods";
import type { DappSession } from "@/wallet/services/interaction/client/models";
import type { Account } from "@/wallet/services/account/client/models";

export * from './events';
export * from './methods';
export * from './models';

export const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

/**
 * Client for interaction with external services via messaging API
 */
export class WalletConnectServiceClient extends ServiceClient {
    /**
     * Creates WalletConnectServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        private readonly onProposalExpire?: (payload: any) => void,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case WalletConnectServiceEvent.ProposalExpire:
                if (this.onProposalExpire) {
                    try {this.onProposalExpire((message as WalletConnectServiceEventMessage).payload);}
                    catch {}
                }
                break;
            // case NetworkServiceEvent.NetworkUpdated:
            //     if (this.onNetworkUpdated) {
            //         try {this.onNetworkUpdated((message as NetworkServiceEventMessage).network);}
            //         catch {}
            //     }
            //     break;
            // case NetworkServiceEvent.NetworkDeleted:
            //     if (this.onNetworkDeleted) {
            //         try {this.onNetworkDeleted((message as NetworkServiceEventMessage).network);}
            //         catch {}
            //     }
            //     break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    public connectByURI(uri: string): Promise<void> {
        return this.request(new ConnectByURIRequest(uri));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public validateProposal(payload: any, address: string): Promise<void> {
        console.log('public validateProposal(payload: any, address: string): Promise<void> {', address);
        
        return this.request(new ValidateProposalRequest(payload, address));
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public approveDappSession(payload: any, profileId: string, accounts: Array<Account>): Promise<DappSession | undefined> {
        return this.request(new ApproveDappSessionRequest(payload, profileId, accounts));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public rejectDappSession(payload: any): Promise<void> {
        return this.request(new RejectDappSessionRequest(payload));
    }

    public dropDappSession(dappSession: DappSession): Promise<void> {
        return this.request(new DropDappSessionRequest(dappSession));
    }

    // /**
    //  * Returns a list of networks.
    //  */
    // public getNetworks(): Promise<Network[]> {
    //     return this.request(new GetNetworksRequest());
    // }

    // /**
    //  * Returns a network with the specified id, or undefined if it doesn't exist.
    //  * @param id Network id.
    //  */
    // public getNetwork(id: string): Promise<Network | undefined> {
    //     return this.request(new GetNetworkRequest(id));
    // }
    
    // /**
    //  * Creates and returns a new network.
    //  * @param name Display name.
    //  * @param rpcUrl RPC URL the wallet will connect to.
    //  * @emits `NetworkAdded` event.
    //  */
    // public addNetwork(name: string, rpcUrl: string): Promise<Network> {
    //     return this.request(new AddNetworkRequest(rpcUrl, name));
    // }
    
    // /**
    //  * Changes network display name and RPC URL and returns the updated network, or undefined if it doesn't exist.
    //  * @param id Network id.
    //  * @param name New display name.
    //  * @param rpcUrl New RPC URL.
    //  * @emits `NetworkUpdated` event.
    //  */
    // public updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
    //     return this.request(new UpdateNetworkRequest(id, rpcUrl, name));
    // }

    // /**
    //  * Deletes network with the specified id.
    //  * @param id Network id.
    //  * @emits `NetworkDeleted` event.
    //  */
    // public deleteNetwork(id: string): Promise<void> {
    //     return this.request(new DeleteNetworkRequest(id));
    // }
}
