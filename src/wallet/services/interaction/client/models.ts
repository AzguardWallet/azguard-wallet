/**
 * Interaction request info.
 */
export class InteractionRequest {
    /**
     * Creates Interaction request.
     * @param id Randomly generated id.
     * @param payload Request payload.
     */
    constructor(
        public readonly id: string,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload: Record<string, any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly resolve?: (value: any) => void,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly reject?: (value: any) => void,
        // public readonly result?: [(result: any) => void, (error: string) => void],
    ) {}
}

/**
 * Dapp session info.
 */
export type Namespace = {
    chains?: string[],
    methods: string[],
    events?: string[],
    accounts?: string[],
}

export type Namespaces = Record<string, Namespace>

export type DappMetadata = {
    name: string,
    description?: string,
    url?: string,
    icon?: string,
}

export class DappSession {
    /**
     * Creates Dapp session.
     * @param id Randomly generated id or WalletConnect session topic.
     * @param dappMetadata Dapp metadata.
     * @param namespaces Session permissions.
     * @param expiry Session expiration timestamp.
     * @param profileId Profile id.
     */
    constructor(
        public readonly id: string,
        public readonly dappMetadata: DappMetadata,
        public readonly namespaces: Namespaces,
        public readonly expiry: number,
        public readonly profileId: string,
    ) {}
}
