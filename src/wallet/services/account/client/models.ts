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
     */
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly address: string,
        public readonly index: number,
        public readonly type: AccountType,
        public readonly name: string,
        public readonly visible: boolean,
    ) {}
}