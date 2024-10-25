export interface INetwork {
    readonly id: string;
    readonly name: string;
    readonly pxeUrl: string;
}

export interface INetworkManager {
    getNetworks(): Promise<Array<INetwork>>;
    getActiveNetwork(): Promise<INetwork>;
    setActiveNetwork(network: INetwork): Promise<INetwork>;
}