export const DAPP_SESSION_SERVICE_NAME = "dapp-session";

export type DappMetadata = {
    name?: string;
    description?: string;
    logo?: string;
    url?: string;
};

export type DappPermissions = {
    chains?: string[];
    methods?: string[];
    events?: string[];
};

export type GrantedCapabilityRecord = {
    capability: any;
    grantedAt: number;
};

export type RejectedCapabilityRecord = {
    capabilityType: string;
    rejectedAt: number;
};

export type DappSession = {
    id: string;
    profileId: string;
    dappMetadata: DappMetadata;
    permissions: DappPermissions[];
    accounts: string[];
    confirmationLevel: AccessLevel;
    expiry: number;
    verificationHash?: string;
    trustedVerification?: boolean;
    accountAliases?: Record<string, string>;
    capabilityGrants?: GrantedCapabilityRecord[];
    capabilityRejections?: RejectedCapabilityRecord[];
};

export enum AccessLevel {
    None = 0,
    AppState = 1,
    PublicData = 2,
    PxeState = 3,
    PrivateData = 4,
    Transactions = 5,
}

export type Methods = {
    getDappSessions(): DappSession[];
    getDappSession(sessionId: string): DappSession;
    addDappSession(
        dappMetadata: DappMetadata,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): DappSession;
    updateDappSession(
        sessionId: string,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): DappSession;
    deleteDappSession(sessionId: string): DappSession;
    setVerificationHash(sessionId: string, verificationHash: string): DappSession;
    setTrustedVerification(sessionId: string, trusted: boolean): DappSession;
    setAccountAliases(sessionId: string, aliases: Record<string, string>): DappSession;
    setCapabilityGrants(sessionId: string, grants: GrantedCapabilityRecord[]): DappSession;
    getCapabilityGrants(sessionId: string): GrantedCapabilityRecord[];
    setCapabilityRejections(sessionId: string, rejections: RejectedCapabilityRecord[]): DappSession;
    getCapabilityRejections(sessionId: string): RejectedCapabilityRecord[];
};

export type Events = {
    onDappSessionAdded: DappSession;
    onDappSessionUpdated: DappSession;
    onDappSessionDeleted: DappSession;
};
