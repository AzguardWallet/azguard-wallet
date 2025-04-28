import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { ProfileService } from "@/wallet/services/profile";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    DAPP_SESSION_SERVICE_NAME,
    DappMetadata,
    DappPermissions,
    DappSession,
    GetDappSessionsRequest,
    GetDappSessionsResponse,
    GetDappSessionRequest,
    GetDappSessionResponse,
    AddDappSessionRequest,
    AddDappSessionResponse,
    UpdateDappSessionRequest,
    UpdateDappSessionResponse,
    DeleteDappSessionRequest,
    DeleteDappSessionResponse,
    DappSessionServiceEvent,
    DappSessionServiceEventMessage,
    DappSessionServiceMethod,
} from "./client";

export class DappSessionService extends Service {
    public readonly onDappSessionUpdated: ((dappSession: DappSession) => void)[] = [];
    public readonly onDappSessionDeleted: ((dappSession: DappSession) => void)[] = [];

    private readonly storage: EntityStorage<DappSession>;
    private readonly lock = new Lock();

    public constructor(
        private readonly profiles: ProfileService,
        emit: (event: EventMessage) => void
    ) {        
        super(DAPP_SESSION_SERVICE_NAME, emit);
        this.storage = new EntityStorage("azguard:core:dappSessions", StorageType.Local);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case DappSessionServiceMethod.GetDappSessions: {
                const _request = request as GetDappSessionsRequest;
                try {
                    const res = await this.getDappSessions();
                    return new GetDappSessionsResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetDappSessionsResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.GetDappSession: {
                const _request = request as GetDappSessionRequest;
                try {
                    const res = await this.getDappSession(_request.sessionId);
                    return new GetDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetDappSessionResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.AddDappSession: {
                const _request = request as AddDappSessionRequest;
                try {
                    const res = await this.addDappSession(
                        _request.dappMetadata,
                        _request.permissions,
                        _request.accounts
                    );
                    return new AddDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new AddDappSessionResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.UpdateDappSession: {
                const _request = request as UpdateDappSessionRequest;
                try {
                    const res = await this.updateDappSession(
                        _request.sessionId,
                        _request.permissions,
                        _request.accounts,
                    );
                    return new UpdateDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new UpdateDappSessionResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            case DappSessionServiceMethod.DeleteDappSession: {
                const _request = request as DeleteDappSessionRequest;
                try {
                    const res = await this.deleteDappSession(_request.sessionId);
                    return new DeleteDappSessionResponse(_request, res);
                }
                catch (error: unknown) {
                    return new DeleteDappSessionResponse(_request, undefined, (error as Error)?.message ?? "Unknown error");
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public  async getDappSessions(): Promise<DappSession[]> {
        const profile = await this.profiles.getActiveProfile();
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
        if (session && await this.isExpired(session)) {
            return undefined;
        }
        return session;
    }
    
    public async addDappSession(dappMetadata: DappMetadata, permissions: DappPermissions[], accounts: string[]): Promise<DappSession> {
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
    
    public async updateDappSession(sessionId: string, permissions: DappPermissions[], accounts: string[]): Promise<DappSession> {
        try {
            await this.lock.enter();
                
            const session = await this.storage.get(sessionId);
            if (!session) {
                throw new Error("Invalid id");
            }
            session.permissions = permissions;
            session.accounts = accounts;
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
        if (session.expiry < Date.now()) {
            try {
                await this.lock.enter();

                if (await this.storage.contains(session.id)) {
                    console.debug(`session ${session.id} has expired`);
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
        try {
            await this.lock.enter();

            const now = Date.now();
            const sessions = await this.storage.getValues();
            for (const session of sessions.filter(x => x.expiry < now)) {
                console.debug(`session ${session.id} has expired`);
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
        console.debug(`profile ${profileId} deleted, remove related dapp sessions`);
        try {
            await this.lock.enter();
            const sessions = (await this.storage.getValues()).filter(x => x.profileId === profileId);
            for (const session of sessions) {
                console.debug(`remove session #${session.id}`);
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
}