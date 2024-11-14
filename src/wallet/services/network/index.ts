import { createPXEClient } from "@aztec/aztec.js";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex } from "@/wallet/utils";
import {
    AddNetworkRequest,
    AddNetworkResponse,
    DeleteNetworkRequest,
    DeleteNetworkResponse,
    GetNetworkRequest,
    GetNetworkResponse,
    GetNetworksRequest,
    GetNetworksResponse,
    Network,
    NETWORK_SERVICE_NAME,
    NetworkServiceEvent,
    NetworkServiceEventMessage,
    NetworkServiceMethod,
    UpdateNetworkRequest,
    UpdateNetworkResponse
} from "./client";

type NetworkDto = {
    name: string,
    rpcUrl: string,
    chainId: number,
}

export class NetworkService extends Service {
    private readonly networks: EntityStorage<NetworkDto>;

    constructor(emit: (event: EventMessage) => void) {
        super(NETWORK_SERVICE_NAME, emit);
        this.networks = new EntityStorage("azguard:core:networks", StorageType.Local);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case NetworkServiceMethod.GetNetworks: {
                const _request = request as GetNetworksRequest;
                try {
                    return new GetNetworksResponse(_request, await this.getNetworks());
                }
                catch (error: any) {
                    return new GetNetworksResponse(_request, undefined, error.message);
                }
            }
            case NetworkServiceMethod.AddNetwork: {
                const _request = request as AddNetworkRequest;
                try {
                    const network = await this.addNetwork(_request.name, _request.rpcUrl);
                    this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkAdded, network));
                    return new AddNetworkResponse(_request, network);
                }
                catch (error: any) {
                    return new AddNetworkResponse(_request, undefined, error.message);
                }
            }
            case NetworkServiceMethod.GetNetwork: {
                const _request = request as GetNetworkRequest;
                try {
                    const network = await this.getNetwork(_request.networkId);
                    return new GetNetworkResponse(_request, network);
                }
                catch (error: any) {
                    return new GetNetworkResponse(_request, undefined, error.message);
                }
            }
            case NetworkServiceMethod.UpdateNetwork: {
                const _request = request as UpdateNetworkRequest;
                try {
                    const network = await this.setNetwork(_request.networkId, _request.name, _request.rpcUrl);
                    this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkUpdated, network));
                    return new UpdateNetworkResponse(_request, network);
                }
                catch (error: any) {
                    return new UpdateNetworkResponse(_request, undefined, error.message);
                }
            }
            case NetworkServiceMethod.DeleteNetwork: {
                const _request = request as DeleteNetworkRequest;
                try {
                    const network = await this.getNetwork(_request.networkId);
                    if (network) {
                        await this.deleteNetwork(_request.networkId);
                        this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkDeleted, network));
                    }
                    return new DeleteNetworkResponse(_request, network);
                }
                catch (error: any) {
                    return new DeleteNetworkResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async getNetworks(): Promise<Array<Network>> {
        const networks = await this.networks.getAll();
        if (networks.length === 0) {
            return [await this._addNetwork("Sandbox", "https://rpc.sandbox.azguardwallet.io", 31337)];
        }
        return networks.map(([id, dto]) => new Network(id, dto.name, dto.rpcUrl, dto.chainId));
    }

    public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
        const [chainId, _] = await this._getNodeInfo(rpcUrl);
        return this._addNetwork(name, rpcUrl, chainId);
    }

    public async getNetwork(id: string): Promise<Network | undefined> {
        const network = await this.networks.get(id);
        return network !== undefined ? new Network(id, network.name, network.rpcUrl, network.chainId) : undefined;
    }

    public async setNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
        const [chainId, _] = await this._getNodeInfo(rpcUrl);
        await this.networks.set(id, {name, rpcUrl, chainId});
        return new Network(id, name, rpcUrl, chainId);
    }

    public deleteNetwork(id: string): Promise<void> {
        return this.networks.delete(id);
    }

    private async _addNetwork(name: string, rpcUrl: string, chainId: number): Promise<Network> {
        let id: string;
        do { id = getRandomHex(8); }
        while (await this.networks.contains(id));
        await this.networks.set(id, {name, rpcUrl, chainId});
        return new Network(id, name, rpcUrl, chainId);
    }

    private async _getNodeInfo(rpcUrl: string): Promise<[number, number]> {
        try {
            const pxe = createPXEClient(rpcUrl);
            const nodeInfo = await pxe.getNodeInfo()
            return [nodeInfo.l1ChainId, nodeInfo.protocolVersion];
        } 
        catch {
            throw new Error('failed to fetch node info');
        }
    }
}