/**
 * Network connection info.
 */
export class Network {
    /**
     * Creates Network instance.
     * @param id Randomly generated id.
     * @param name Display name.
     * @param rpcUrl URL of the RPC the wallet should connect to.
     * @param chainId Chain id, automatically determined from the RPC.
     */
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly rpcUrl: string,
        public readonly chainId: number,
    ) {}
}