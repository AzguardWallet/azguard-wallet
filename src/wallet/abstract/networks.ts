export interface INetwork {
    readonly id: string;
    readonly name: string;
    readonly chainId: number;
    readonly rpcUrl: string;
}

export interface INetworkManager {
    getNetworks(): Promise<Array<INetwork>>;
    addNetwork(rpcUrl: string, name: string): Promise<INetwork>;
    getNetwork(id: string): Promise<INetwork | null>;
    setNetwork(id: string, name: string, rpcUrl: string): Promise<INetwork>;
    deleteNetwork(id: string): Promise<void>;
}