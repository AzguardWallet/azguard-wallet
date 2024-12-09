export class WCSessionParams {
    /**
     * Wallet connect session params.
     * @param topic WC session id.
     * @param expiry Session expiration timestamp.
     * @param chains Allowed chains.
     * @param methods Allowed methods.
     * @param events Allowed events.
    */
    constructor(
        public readonly topic: string,
        public readonly expiry: number,
        public readonly chains: string[],
        public readonly methods: string[],
        public readonly events: string[],
    ) {}
}
