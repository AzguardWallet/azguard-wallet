import { INetwork } from "../abstract";

export class Network implements INetwork {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly chainId: number,
        public readonly rpcUrl: string,
    ) {}
}