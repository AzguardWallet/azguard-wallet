import type { IAction } from "@/wallet/services/execution/client/models";

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

/**
 * Dapp requests
 */
export class DappSessionProposal {
    /**
     * Dapp session creation request.
     * @param requiredNamespaces Required dapp session parameters.
     * @param dappMetadata Dapp metadata.
     * @param optionalNamespaces Optional dapp session parameters.
     */
    constructor(
        public readonly requiredNamespaces: Namespaces,
        public readonly dappMetadata: DappMetadata,
        public readonly optionalNamespaces?: Namespaces,
    ) {}
}

export class DappSessionRequest {
    /**
     * Request for payload execution.
     * @param sessionId Existing dapp session id.
     * @param accountAddress Address for execution.
     * @param chainId Network for execution (CAIP format).
     * @param actions Actions to be executed.
     */
    constructor(
        public readonly sessionId: string,
        public readonly accountAddress: string,
        public readonly chainId: string,
        public readonly actions: IAction[],
    ) {}
}
