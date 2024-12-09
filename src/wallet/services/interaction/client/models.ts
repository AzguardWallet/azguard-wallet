import type { Account } from "@/wallet/services/account/client/models"
import type { WCSessionParams } from "@/wallet/services/wallet-connect/client/models";

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
export type GetDappSessionParams = {
    id?: string,
    topic?: string,
}

export class DappSession {
    /**
     * Creates Dapp session.
     * @param id Randomly generated id.
     * @param name Dapp name.
     * @param params WC session params.
     * @param profileId Profile id.
     * @param chainIds List of chain ids using by the dApp.
     * @param accounts List of accounts shared with the dApp.
     * @param url Dapp url.
     * @param icon Dapp logo.
     */
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly params: WCSessionParams,
        public readonly profileId: string,
        public readonly chainIds: Array<number>,
        public readonly accounts: Array<Account>,
        public readonly url?: string,
        public readonly icon?: string,
    ) {}
}
