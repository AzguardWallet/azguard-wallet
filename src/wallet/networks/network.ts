import { INetwork } from "../abstract/networks";

export class Network implements INetwork {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly chainId: string,
        public readonly rpcUrl: string,
    ) {}
}