import { createPXEClient } from "@aztec/aztec.js";
import { INetwork, INetworkManager } from "../abstract/networks";
import { EntityStorage, StorageType } from "../storage";
import { getRandomHex } from "../utils";
import { Network } from "./network";

type NetworkDto = {
    name: string,
    chainId: string,
    rpcUrl: string,
}

export class RpcError extends Error { }

export class NetworkManager implements INetworkManager {
    private readonly networks: EntityStorage<NetworkDto>;

    constructor() {
        this.networks = new EntityStorage("azguard:core:networks", StorageType.Local);
    }

    public async getNetworks(): Promise<Array<INetwork>> {
        const networks = await this.networks.getAll();
        if (networks.length === 0) {
            return [await this._addNetwork("Sandbox", "https://rpc.tzkt.io/aztec/", "31337")];
        }
        return networks.map(([id, dto]) => new Network(id, dto.name, dto.chainId, dto.rpcUrl));
    }

    public async addNetwork(name: string, rpcUrl: string): Promise<INetwork> {
        const chainId = await this._getChainId(rpcUrl); // throws RpcError
        return this._addNetwork(name, rpcUrl, chainId);
    }

    public async getNetwork(id: string): Promise<INetwork | null> {
        const network = await this.networks.get(id);
        return network !== null ? new Network(id, network.name, network.chainId, network.rpcUrl) : null;
    }

    public async setNetwork(id: string, rpcUrl: string, name: string): Promise<INetwork> {
        const chainId = await this._getChainId(rpcUrl); // throws RpcError
        await this.networks.set(id, {name, chainId, rpcUrl});
        return new Network(id, name, chainId, rpcUrl);
    }

    public deleteNetwork(id: string): Promise<void> {
        return this.networks.delete(id);
    }

    private async _addNetwork(name: string, rpcUrl: string, chainId: string): Promise<INetwork> {
        let id: string;
        do { id = getRandomHex(8); }
        while (await this.networks.contains(id));
        await this.networks.set(id, {name, chainId, rpcUrl});
        return new Network(id, name, chainId, rpcUrl);
    }

    private async _getChainId(rpcUrl: string): Promise<string> {
        try {
            const pxe = createPXEClient(rpcUrl);
            const nodeInfo = await pxe.getNodeInfo()
            return `${nodeInfo.l1ChainId}`;
        } 
        catch {
            throw new RpcError();
        }
    }
}