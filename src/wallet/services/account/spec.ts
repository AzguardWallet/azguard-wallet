export const ACCOUNT_SERVICE_NAME = "account";

export enum AccountType {
    /** Default implementation v0. */
    Azguard_v0 = 0,
}

export type Account = {
    /** Profile Id (part of the derivation path). */
    profileId: string;
    /** Chain Id (part of the derivation path). */
    chainId: number;
    /** Address of the account contract. */
    address: string;
    /** Index (part of the derivation path). */
    index: number;
    /** Type of the account contract (part of the derivation path). */
    type: AccountType;
    /** Display name */
    name: string;
    /** Flag, determining whether the account is active or hidden. */
    visible: boolean;
};

export type Methods = {
    /**
     * Returns a list of accounts.
     * @param profileId Profile, determining accounts scope (each profile + chain has its own set of accounts).
     * @param chainId Chain, determining accounts scope (each profile + chain has its own set of accounts).
     * @param all Whether to return all (including hidden) or only active accounts.
     */
    getAccounts(profileId: string, chainId: number, all?: boolean): Account[];

    /**
     * Returns an account with the specified address, or undefined if it doesn't exist.
     * @param profileId Profile, determining accounts scope (each profile + chain has its own set of accounts).
     * @param chainId Chain, determining accounts scope (each profile + chain has its own set of accounts).
     * @param address Account contract address.
     */
    getAccount(profileId: string, chainId: number, address: string): Account | undefined;

    /**
     * Creates and returns a new account.
     * @param profileId Profile, determining accounts scope (each profile + chain has its own set of accounts).
     * @param chainId Chain, determining accounts scope (each profile + chain has its own set of accounts).
     * @param type Account contract type.
     * @param name Display name.
     */
    createAccount(profileId: string, chainId: number, type: AccountType, name: string): Account;

    /**
     * Changes an account name and returns the account, or undefined if it doesn't exist.
     * @param profileId Profile, determining accounts scope (each profile + chain has its own set of accounts).
     * @param chainId Chain, determining accounts scope (each profile + chain has its own set of accounts).
     * @param address Account contract address.
     * @param name Display name.
     */
    changeAccountName(profileId: string, chainId: number, address: string, name: string): Account | undefined;

    /**
     * Changes an account visibility and returns the account, or undefined if it doesn't exist.
     * @param profileId Profile, determining accounts scope (each profile + chain has its own set of accounts).
     * @param chainId Chain, determining accounts scope (each profile + chain has its own set of accounts).
     * @param address Account contract address.
     * @param visible Visibility flag.
     */
    changeAccountVisibility(profileId: string, chainId: number, address: string, visible: boolean): Account | undefined;
};

export type Events = {
    /** Emitted when a new account is created */
    onAccountAdded: Account;
    /** Emitted when an existing account is updated */
    onAccountUpdated: Account;
    /** Emitted when an existing account is deleted */
    onAccountDeleted: Account;
};
