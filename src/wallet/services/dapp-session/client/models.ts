export type DappMetadata = {
    name?: string,
    description?: string,
    logo?: string,
    url?: string,
};

export type DappPermissions = {
    chains?: string[],
    methods?: string[],
    events?: string[],
};

export type DappSession = {
    id: string,
    profileId: string,
    dappMetadata: DappMetadata,
    permissions: DappPermissions[],
    accounts: string[],
    confirmationLevel: AccessLevel,
    expiry: number,
};

export enum AccessLevel {
    None = 0,
    AppState = 1,
    PublicData = 2,
    PxeState = 3,
    PrivateData = 4,
    Transactions = 5,
}