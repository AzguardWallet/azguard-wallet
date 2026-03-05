import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import {
    AccessLevel,
    DAPP_SESSION_SERVICE_NAME,
    DappMetadata,
    DappPermissions,
    DappSession,
    GrantedCapabilityRecord,
    Events,
    Methods,
} from "./spec";

export * from "./spec";

export class DappSessionServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onDappSessionAdded = new EventHandler<DappSession>();
    public readonly onDappSessionUpdated = new EventHandler<DappSession>();
    public readonly onDappSessionDeleted = new EventHandler<DappSession>();

    public constructor(name?: string) {
        super(DAPP_SESSION_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getDappSessions(): Promise<DappSession[]> {
        return this.request("getDappSessions");
    }

    public getDappSession(sessionId: string): Promise<DappSession> {
        return this.request("getDappSession", sessionId);
    }

    public addDappSession(
        dappMetadata: DappMetadata,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        return this.request("addDappSession", dappMetadata, permissions, accounts, confirmationLevel);
    }

    public updateDappSession(
        sessionId: string,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        return this.request("updateDappSession", sessionId, permissions, accounts, confirmationLevel);
    }

    public deleteDappSession(sessionId: string): Promise<DappSession> {
        return this.request("deleteDappSession", sessionId);
    }

    public setVerificationHash(sessionId: string, verificationHash: string): Promise<DappSession> {
        return this.request("setVerificationHash", sessionId, verificationHash);
    }

    public setTrustedVerification(sessionId: string, trusted: boolean): Promise<DappSession> {
        return this.request("setTrustedVerification", sessionId, trusted);
    }

    public setAccountAliases(sessionId: string, aliases: Record<string, string>): Promise<DappSession> {
        return this.request("setAccountAliases", sessionId, aliases);
    }

    public setCapabilityGrants(sessionId: string, grants: GrantedCapabilityRecord[]): Promise<DappSession> {
        return this.request("setCapabilityGrants", sessionId, grants);
    }

    public getCapabilityGrants(sessionId: string): Promise<GrantedCapabilityRecord[]> {
        return this.request("getCapabilityGrants", sessionId);
    }
}
