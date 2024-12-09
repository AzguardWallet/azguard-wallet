import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { NetworkServiceEvent, NetworkServiceEventMessage } from "./events";
import { Network, NodeStatus } from "./models";
import {
    AddNetworkRequest,
    DeleteNetworkRequest,
    GetNetworkRequest,
    GetNetworksRequest,
    UpdateNetworkRequest,
    SetDefaultRequest,
    GetNodeStatusRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const NETWORK_SERVICE_NAME = "network";

/**
 * Client for interaction with the NetworkService via messaging API
 */
export class NetworkServiceClient extends ServiceClient {
    /**
     * Creates NetworkServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onNetworkAdded Callback, called when a new network was created.
     * @param onNetworkUpdated Callback, called when an existing network was updated.
     * @param onNetworkDeleted Callback, called when an existing network was deleted.
     * @param onDefaultNetworkChanged Callback, called when an existing network was set as default.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onNetworkAdded?: (network: Network) => void,
        private readonly onNetworkUpdated?: (network: Network) => void,
        private readonly onNetworkDeleted?: (network: Network) => void,
        private readonly onDefaultNetworkChanged?: (network: Network) => void,
    ) {
        super(NETWORK_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case NetworkServiceEvent.NetworkAdded:
                if (this.onNetworkAdded) {
                    try {this.onNetworkAdded((message as NetworkServiceEventMessage).network);}
                    catch {}
                }
                break;
            case NetworkServiceEvent.NetworkUpdated:
                if (this.onNetworkUpdated) {
                    try {this.onNetworkUpdated((message as NetworkServiceEventMessage).network);}
                    catch {}
                }
                break;
            case NetworkServiceEvent.NetworkDeleted:
                if (this.onNetworkDeleted) {
                    try {this.onNetworkDeleted((message as NetworkServiceEventMessage).network);}
                    catch {}
                }
                break;
            case NetworkServiceEvent.DefaultNetworkChanged:
                if (this.onDefaultNetworkChanged) {
                    try {this.onDefaultNetworkChanged((message as NetworkServiceEventMessage).network);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of networks.
     */
    public getNetworks(chainId?: number): Promise<Network[]> {
        return this.request(new GetNetworksRequest(chainId));
    }

    /**
     * Returns a network with the specified id, or undefined if it doesn't exist.
     * @param id Network id.
     * @throws If the network with the specified id doesn't exist.
     */
    public getNetwork(id: string): Promise<Network> {
        return this.request(new GetNetworkRequest(id));
    }
    
    /**
     * Creates and returns a new network.
     * @param name Display name.
     * @param rpcUrl RPC URL the wallet will connect to.
     * @emits `NetworkAdded` event.
     * @throws If the specified RPC is invalid or not responding.
     */
    public addNetwork(name: string, rpcUrl: string): Promise<Network> {
        return this.request(new AddNetworkRequest(rpcUrl, name));
    }
    
    /**
     * Changes network display name and RPC URL and returns the updated network, or undefined if it doesn't exist.
     * @param id Network id.
     * @param name New display name.
     * @param rpcUrl New RPC URL.
     * @emits `NetworkUpdated` event.
     * @throws If the network with the specified id doesn't exist, or the specified RPC is invalid or not responding.
     */
    public updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
        return this.request(new UpdateNetworkRequest(id, rpcUrl, name));
    }

    /**
     * Deletes network with the specified id.
     * @param id Network id.
     * @emits `NetworkDeleted` event.
     * @throws If the network with the specified id doesn't exist.
     */
    public deleteNetwork(id: string): Promise<Network> {
        return this.request(new DeleteNetworkRequest(id));
    }

    /**
     * Deletes network with the specified id.
     * @param id Network id.
     * @emits `NetworkUpdated` events (two).
     * @throws If the network with the specified id doesn't exist.
     */
    public setDefault(id: string): Promise<Network> {
        return this.request(new SetDefaultRequest(id));
    }

    /**
     * Fetches and validates node info from RPC, and returns the status.
     * @param id Network id.
     * @throws If the network with the specified id doesn't exist.
     */
    public getNodeStatus(id: string): Promise<NodeStatus> {
        return this.request(new GetNodeStatusRequest(id));
    }
}
