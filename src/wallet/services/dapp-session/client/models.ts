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
    expiry: number,
};
