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
    Events,
    Methods,
} from "./spec";
import type { SerializedCapability } from "@/wallet/services/dapp-interaction/scope-enforcement";

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
        capabilities?: SerializedCapability[],
    ): Promise<DappSession> {
        return this.request("updateDappSession", sessionId, permissions, accounts, confirmationLevel, capabilities);
    }

    public deleteDappSession(sessionId: string): Promise<DappSession> {
        return this.request("deleteDappSession", sessionId);
    }
}
