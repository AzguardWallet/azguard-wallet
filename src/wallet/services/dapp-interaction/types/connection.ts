import { DappMetadata, DappPermissions } from "@/wallet/services/dapp-session/client";

export type ConnectionParams = {
    dappMetadata: DappMetadata,
    requiredPermissions: DappPermissions[],
    optionalPermissions?: DappPermissions[],
};

export type DappSessionInfo = {
    id: string,
    permissions: DappPermissions[],
    accounts: string[],
};