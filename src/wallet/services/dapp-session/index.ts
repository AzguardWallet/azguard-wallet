import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { ProfileService } from "@/wallet/services/profile";
import type { ILogs } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    DAPP_SESSION_SERVICE_NAME,
    type DappMetadata,
    type DappPermissions,
    type DappSession,
    type GetDappSessionsRequest,
    GetDappSessionsResponse,
    type GetDappSessionRequest,
    GetDappSessionResponse,
    type AddDappSessionRequest,
    AddDappSessionResponse,
    type UpdateDappSessionRequest,
    UpdateDappSessionResponse,
    type DeleteDappSessionRequest,
    DeleteDappSessionResponse,
    DappSessionServiceEvent,
    DappSessionServiceEventMessage,
    DappSessionServiceMethod,
    AccessLevel,
} from "./client";

export class DappSessionService extends Service {
    public readonly onDappSessionUpdated: ((dappSession: DappSession) => void)[] = [];
    public readonly onDappSessionDeleted: ((dappSession: DappSession) => void)[] = [];

    private readonly storage: EntityStorage<DappSession>;
    private readonly lock = new Lock();
	private init: Promise<void> | null;

    public constructor(
        private readonly profiles: ProfileService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {        
        super(DAPP_SESSION_SERVICE_NAME, logger, emit);
        this.storage = new EntityStorage("azguard:core:dappSessions", StorageType.Local);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
		this.init = this.initialize();
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
		await this.ensureInitialized();
        switch(request.method) {
            case DappSessionServiceMethod.GetDappSessions: {
                const _request = request as GetDappSessionsRequest;
                try {
                    const res = await this.getDappSessions();
                    return new GetDappSessionsResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetDappSessionsResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.GetDappSession: {
                const _request = request as GetDappSessionRequest;
                try {
                    const res = await this.getDappSession(_request.sessionId);
                    return new GetDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetDappSessionResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.AddDappSession: {
                const _request = request as AddDappSessionRequest;
                try {
                    const res = await this.addDappSession(
                        _request.dappMetadata,
                        _request.permissions,
                        _request.accounts,
                        _request.confirmationLevel,
                    );
                    return new AddDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new AddDappSessionResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.UpdateDappSession: {
                const _request = request as UpdateDappSessionRequest;
                try {
                    const res = await this.updateDappSession(
                        _request.sessionId,
                        _request.permissions,
                        _request.accounts,
                        _request.confirmationLevel,
                    );
                    return new UpdateDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new UpdateDappSessionResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.DeleteDappSession: {
                const _request = request as DeleteDappSessionRequest;
                try {
                    const res = await this.deleteDappSession(_request.sessionId);
                    return new DeleteDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new DeleteDappSessionResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`)
                return undefined;
            }                
        }
    }

    public async getDappSessions(): Promise<DappSession[]> {
		await this.ensureInitialized();
        const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
        await this.deleteExpired();
        return (await this.storage.getValues()).filter(x => x.profileId === profile.id);
    }
    
    public async getDappSession(sessionId: string): Promise<DappSession> {
		await this.ensureInitialized();
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
		await this.ensureInitialized();
        const session = await this.storage.get(sessionId);
        if (session && await this.isExpired(session)) {
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
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet is locked");
        }
        await this.deleteExpired();
        try {
            await this.lock.enter();
            
            let id: string;
            do { id = getRandomHex(64); }
            while (await this.storage.contains(id));

            const session: DappSession = {
                id,
                profileId: profile.id,
                dappMetadata: dappMetadata,
                permissions: permissions,
                accounts: accounts,
                confirmationLevel: confirmationLevel,
                expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
            }
            await this.storage.set(session.id, session);
            this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionAdded, session));

            return session;
        }
        finally {
            this.lock.leave();
        }
    }
    
    public async updateDappSession(
        sessionId: string,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
		await this.ensureInitialized();
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
            this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionUpdated, session));
            for (const emit of this.onDappSessionUpdated) {
                try {emit(session)} catch {}
            }

            return session;
        }
        finally {
            this.lock.leave();
        }
    }
    
    public async upgradeDappSession(sessionId: string, newSessionId: string, newExpiry: number): Promise<DappSession> {
		await this.ensureInitialized();
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
            this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionDeleted, oldSession));

            const newSession = {...oldSession, id: newSessionId, expiry: newExpiry};
            await this.storage.set(newSession.id, newSession);
            this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionAdded, newSession));

            return newSession;
        }
        finally {
            this.lock.leave();
        }
    }
    
    public async deleteDappSession(sessionId: string): Promise<DappSession> {
		await this.ensureInitialized();
        try {
            await this.lock.enter();
               
            const session = await this.storage.get(sessionId);
            if (!session) {
                throw new Error("Invalid id");
            }
            await this.storage.delete(sessionId);
            this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionDeleted, session));
            for (const emit of this.onDappSessionDeleted) {
                try {emit(session)} catch {}
            }

            return session;
        }
        finally {
            this.lock.leave();
        }
    }

    public async isExpired(session: DappSession): Promise<boolean> {
		await this.ensureInitialized();
        if (session.expiry < Date.now()) {
            try {
                await this.lock.enter();

                if (await this.storage.contains(session.id)) {
                    this.logDebug(`Session ${session.id} has expired`);
                    await this.storage.delete(session.id);
                    this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionDeleted, session));
                    for (const emit of this.onDappSessionDeleted) {
                        try {emit(session)} catch {}
                    }
                }
            }
            finally {
                this.lock.leave();
            }
            return true;
        }
        return false;
    }

    public async deleteExpired(): Promise<void> {
		await this.ensureInitialized();
        try {
            await this.lock.enter();

            const now = Date.now();
            const sessions = await this.storage.getValues();
            for (const session of sessions.filter(x => x.expiry < now)) {
                this.logDebug(`Session ${session.id} has expired`);
                await this.storage.delete(session.id);
                this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionDeleted, session));
                for (const emit of this.onDappSessionDeleted) {
                    try {emit(session)} catch {}
                }
            }
        }
        finally {
            this.lock.leave();
        }
    }
    
    private readonly onProfileDeleted = async (profileId: string) => {
		await this.ensureInitialized();
        this.logDebug(`Profile ${profileId} deleted, remove related dapp sessions`);
        try {
            await this.lock.enter();
            const sessions = (await this.storage.getValues()).filter(x => x.profileId === profileId);
            for (const session of sessions) {
                this.logDebug(`Remove session #${session.id}`);
                await this.storage.delete(session.id);
                this.emit(new DappSessionServiceEventMessage(DappSessionServiceEvent.DappSessionDeleted, session));
                for (const emit of this.onDappSessionDeleted) {
                    try {emit(session)} catch {}
                }
            }
        } finally {
            this.lock.leave();
        }
    }

	private async initialize(): Promise<void> {
        this.logDebug("Initialize");
		await this.checkMigrations();
        this.logDebug("Initialized");
		this.init = null;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.init) {
			await this.init;
		}
	}

	private async checkMigrations(): Promise<void> {
		try {
            this.logDebug("Check storage migrations");
			switch (await this.storage.getVersion()) {
				case 1: {
                    this.logDebug("No migrations needed");
					break;
				}
				default: {
					await this.migrate_0_1();
					break;
				}
			}
		}
		catch (error: unknown) {
            this.logError("Failed to migrate storage", error);
		}
	}
    
	private async migrate_0_1(): Promise<void> {
        this.logDebug("Migrating storage");
        const sessions = await this.storage.getAll();
        this.logDebug("Set confirmation level");
        for (const [id, session] of sessions) {
            session.confirmationLevel = AccessLevel.Transactions;
            await this.storage.set(id, session);
        }
        this.logDebug("Set storage version to 1");
		await this.storage.setVersion(1);
        this.logDebug("Storage migrated");
    }
}