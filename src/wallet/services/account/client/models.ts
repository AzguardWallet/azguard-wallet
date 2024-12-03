/**
 * Available account contract implementations.
 */
export enum AccountType {
    /** Default implementation v0 */
    Azguard_v0 = 0,
}

/**
 * Accoint info.
 */
export class Account {
    /**
     * Creates Account instance.
     * @param profileId Profile Id (part of the derivation path).
     * @param chainId Chain Id (part of the derivation path).
     * @param address Address of the account contract.
     * @param index Index (part of the derivation path).
     * @param type Type of the account contract (part of the derivation path).
     * @param name Display name.
     * @param visible Flag, determining whether the account is active or hidden (deleted).
     * @param syncStatus Synchronization status (if undefined, then the account is offline or not yet registered).
     */
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly address: string,
        public readonly index: number,
        public readonly type: AccountType,
        public readonly name: string,
        public readonly visible: boolean,
        public readonly syncStatus?: AccountSyncStatus,
    ) {}
}

/**
 * Sync status info
 */
export class AccountSyncStatus {
    /**
     * Creates AccountSyncStatus instance.
     * @param head Known head of the chain.
     * @param blocks How many blocks PXE has synced in total.
     * @param notes How many blocks PXE has processed for a particular account.
     */
    constructor(
        public readonly head: number,
        public readonly blocks: number,
        public readonly notes: number,
    ) {}
}