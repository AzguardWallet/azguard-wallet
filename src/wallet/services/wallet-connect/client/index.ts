// import { EventMessage } from "@/wallet/base/messages";
// import { ServiceClient } from "@/wallet/base/service-client";
// import { NetworkServiceEvent, NetworkServiceEventMessage } from "./events";
// import { Network } from "./models";
// import {
//     AddNetworkRequest,
//     DeleteNetworkRequest,
//     GetNetworkRequest,
//     GetNetworksRequest,
//     UpdateNetworkRequest,
// } from "./methods";

// export * from './events';
// export * from './methods';
// export * from './models';

// export const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

// /**
//  * Client for interaction with the WalletConnectService via messaging API
//  */
// export class WalletConnectServiceClient extends ServiceClient {
//     /**
//      * Creates WalletConnectServiceClient instace.
//      * @param onConnected Callback, called when the client is connected to the background service.
//      * @param onDisconnected Callback, called when the client is disconnected from the background service.
//      * @param onNetworkAdded Callback, called when a new network was created.
//      * @param onNetworkUpdated Callback, called when an existing network was updated.
//      * @param onNetworkDeleted Callback, called when an existing network was deleted.
//      */
//     constructor(
//         onConnected?: () => void,
//         onDisconnected?: () => void,
//         private readonly onNetworkAdded?: (network: Network) => void,
//         private readonly onNetworkUpdated?: (network: Network) => void,
//         private readonly onNetworkDeleted?: (network: Network) => void,
//     ) {
//         super(WALLET_CONNECT_SERVICE_NAME, onConnected, onDisconnected);
//     }

//     protected onEvent(message: EventMessage): void {
//         switch (message.event) {
//             case NetworkServiceEvent.NetworkAdded:
//                 if (this.onNetworkAdded) {
//                     try {this.onNetworkAdded((message as NetworkServiceEventMessage).network);}
//                     catch {}
//                 }
//                 break;
//             case NetworkServiceEvent.NetworkUpdated:
//                 if (this.onNetworkUpdated) {
//                     try {this.onNetworkUpdated((message as NetworkServiceEventMessage).network);}
//                     catch {}
//                 }
//                 break;
//             case NetworkServiceEvent.NetworkDeleted:
//                 if (this.onNetworkDeleted) {
//                     try {this.onNetworkDeleted((message as NetworkServiceEventMessage).network);}
//                     catch {}
//                 }
//                 break;
//             default:
//                 console.error(`Unexpected event type ${message.event}.`);
//                 break;
//         }
//     }

//     /**
//      * Returns a list of networks.
//      */
//     public getNetworks(): Promise<Network[]> {
//         return this.request(new GetNetworksRequest());
//     }

//     /**
//      * Returns a network with the specified id, or undefined if it doesn't exist.
//      * @param id Network id.
//      */
//     public getNetwork(id: string): Promise<Network | undefined> {
//         return this.request(new GetNetworkRequest(id));
//     }
    
//     /**
//      * Creates and returns a new network.
//      * @param name Display name.
//      * @param rpcUrl RPC URL the wallet will connect to.
//      * @emits `NetworkAdded` event.
//      */
//     public addNetwork(name: string, rpcUrl: string): Promise<Network> {
//         return this.request(new AddNetworkRequest(rpcUrl, name));
//     }
    
//     /**
//      * Changes network display name and RPC URL and returns the updated network, or undefined if it doesn't exist.
//      * @param id Network id.
//      * @param name New display name.
//      * @param rpcUrl New RPC URL.
//      * @emits `NetworkUpdated` event.
//      */
//     public updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
//         return this.request(new UpdateNetworkRequest(id, rpcUrl, name));
//     }

//     /**
//      * Deletes network with the specified id.
//      * @param id Network id.
//      * @emits `NetworkDeleted` event.
//      */
//     public deleteNetwork(id: string): Promise<void> {
//         return this.request(new DeleteNetworkRequest(id));
//     }
// }
