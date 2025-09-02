import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import {
    DAPP_SESSION_SERVICE_NAME,
    type DappMetadata,
    type DappPermissions,
    type DappSession,
    AccessLevel,
    Methods,
    Events,
} from "./spec";

export * from "./spec";

export class DappSessionService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = DAPP_SESSION_SERVICE_NAME;

    public readonly onDappSessionAdded = new EventHandler<DappSession>();
    public readonly onDappSessionUpdated = new EventHandler<DappSession>();
    public readonly onDappSessionDeleted = new EventHandler<DappSession>();

    private readonly storage = new EntityStorage<DappSession>("azguard:core:dappSessions", StorageType.Local);
    private readonly lock = new Lock();

    private profileService: ProfileService = null!;

    public constructor(logger: ILogger) {
        super(DAPP_SESSION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
    }

    public async getDappSessions(): Promise<DappSession[]> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        await this.deleteExpired();
        return (await this.storage.getValues()).filter(x => x.profileId === profile.id);
    }

    public async getDappSession(sessionId: string): Promise<DappSession> {
        const session = await this.storage.get(sessionId);
        if (!session) {
            throw new Error("Invalid id");
        }
        if (await this.isExpired(session)) {
            throw new Error("Session expired");
        }
        return session;
    }

    public async tryGetDappSession(sessionId: string): Promise<DappSession | undefined> {
        const session = await this.storage.get(sessionId);
        if (session && (await this.isExpired(session))) {
            return undefined;
        }
        return session;
    }

    public async addDappSession(
        dappMetadata: DappMetadata,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet is locked");
        }
        await this.deleteExpired();
        try {
            await this.lock.enter();

            let id: string;
            do {
                id = getRandomHex(64);
            } while (await this.storage.contains(id));

            const session: DappSession = {
                id,
                profileId: profile.id,
                dappMetadata: dappMetadata,
                permissions: permissions,
                accounts: accounts,
                confirmationLevel: confirmationLevel,
                expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
            };
            await this.storage.set(session.id, session);
            this.emit("onDappSessionAdded", session);

            return session;
        } finally {
            this.lock.leave();
        }
    }

    public async updateDappSession(
        sessionId: string,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        try {
            await this.lock.enter();

            const session = await this.storage.get(sessionId);
            if (!session) {
                throw new Error("Invalid id");
            }
            session.permissions = permissions;
            session.accounts = accounts;
            session.confirmationLevel = confirmationLevel;
            await this.storage.set(sessionId, session);
            this.emit("onDappSessionUpdated", session);

            return session;
        } finally {
            this.lock.leave();
        }
    }

    public async upgradeDappSession(sessionId: string, newSessionId: string, newExpiry: number): Promise<DappSession> {
        try {
            await this.lock.enter();

            if (await this.storage.contains(newSessionId)) {
                throw new Error("Invalid new id");
            }

            const oldSession = await this.storage.get(sessionId);
            if (!oldSession) {
                throw new Error("Invalid id");
            }
            await this.storage.delete(oldSession.id);
            this.emit("onDappSessionDeleted", oldSession);

            const newSession = { ...oldSession, id: newSessionId, expiry: newExpiry };
            await this.storage.set(newSession.id, newSession);
            this.emit("onDappSessionAdded", newSession);

            return newSession;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteDappSession(sessionId: string): Promise<DappSession> {
        try {
            await this.lock.enter();

            const session = await this.storage.get(sessionId);
            if (!session) {
                throw new Error("Invalid id");
            }
            await this.storage.delete(sessionId);
            this.emit("onDappSessionDeleted", session);

            return session;
        } finally {
            this.lock.leave();
        }
    }

    public async isExpired(session: DappSession): Promise<boolean> {
        if (session.expiry < Date.now()) {
            try {
                await this.lock.enter();

                if (await this.storage.contains(session.id)) {
                    this.logDebug(`Session ${session.id} has expired`);
                    await this.storage.delete(session.id);
                    this.emit("onDappSessionDeleted", session);
                }
            } finally {
                this.lock.leave();
            }
            return true;
        }
        return false;
    }

    public async deleteExpired(): Promise<void> {
        try {
            await this.lock.enter();

            const now = Date.now();
            const sessions = await this.storage.getValues();
            for (const session of sessions.filter(x => x.expiry < now)) {
                this.logDebug(`Session ${session.id} has expired`);
                await this.storage.delete(session.id);
                this.emit("onDappSessionDeleted", session);
            }
        } finally {
            this.lock.leave();
        }
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`Profile ${profile.id} deleted, remove related dapp sessions`);
        try {
            await this.lock.enter();
            const sessions = (await this.storage.getValues()).filter(x => x.profileId === profile.id);
            for (const session of sessions) {
                this.logDebug(`Remove session #${session.id}`);
                await this.storage.delete(session.id);
                this.emit("onDappSessionDeleted", session);
            }
        } finally {
            this.lock.leave();
        }
    };
}
