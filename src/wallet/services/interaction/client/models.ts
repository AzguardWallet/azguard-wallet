/**
 * Interaction request info.
 */
export enum Status {
    Pending = 'pending',
    Success = 'success',
    Failed = 'failed',
}

export class InteractionRequest {
    /**
     * Creates Interaction request.
     * @param id Randomly generated id.
     * @param status Request status.
     * @param payload Request payload.
     * @param result Request result.
     */
    constructor(
        public readonly id: string,
        public readonly status: Status,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload: Record<string, any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly result?: Record<string, any>,
    ) {}
}

/**
 * Dapp session info.
 */
export class DappSession {
    /**
     * Creates Dapp session.
     * @param id Randomly generated id.
     * @param name Dapp name.
     * @param topic Dapp session wc id.
     * @param expiry Dapp session expiration timestamp.
     * @param url Dapp url.
     * @param icon Dapp logo. chain ids, profileId, accounts.addresses
     */
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly topic: string,
        public readonly expiry: number,
        public readonly url?: string,
        public readonly icon?: string,
    ) {}
}
