import { Fr } from "@aztec/aztec.js";
import { RequestMessage, ResponseMessage, EventMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { EntityStorage, SimpleStorage, StorageType } from "@/wallet/storage";
import { array_equals, getRandomHex } from "@/wallet/utils";
import { EncryptionKey } from "./encryption-key";
import {
    ChangeProfileNameRequest,
    ChangeProfileNameResponse,
    ChangeProfilePasswordRequest,
    ChangeProfilePasswordResponse,
    CreateProfileRequest,
    CreateProfileResponse,
    DeleteProfileRequest,
    DeleteProfileResponse,
    ExportEncryptedRequest,
    ExportEncryptedResponse,
    ExportPlainRequest,
    ExportPlainResponse,
    GetActiveProfileRequest,
    GetActiveProfileResponse,
    GetProfilesRequest,
    GetProfilesResponse,
    ImportEncryptedRequest,
    ImportEncryptedResponse,
    ImportPlainRequest,
    ImportPlainResponse,
    LockRequest,
    LockResponse,
    PROFILE_SERVICE_NAME,
    Profile,
    ProfileServiceEvent,
    ProfileServiceEventMessage,
    ProfileServiceMethod,
    UnlockProfileRequest,
    UnlockProfileResponse
} from "./client";

type ProfileDto = {
    name: string;
    guard: string;
    secret: string;
}

type SessionDto = {
    profile: string;
    passhash: string;
    since: number;
}

const encryptionGuard = new Uint8Array([6, 11, 20, 20, 22, 4, 20, 22]);

export class ProfileService extends Service {
    public readonly onProfileDeleted: ((profileId: string) => void)[] = [];
    public readonly onSessionOpened: ((profileId: string) => void)[] = [];
    public readonly onSessionClosed: (() => void)[] = [];

    private readonly profiles: EntityStorage<ProfileDto>;
    private readonly session: SimpleStorage<SessionDto>;

    constructor(emit: (event: EventMessage) => void) {
        super(PROFILE_SERVICE_NAME, emit);
        this.profiles = new EntityStorage('azguard:core:profiles', StorageType.Local);
        this.session = new SimpleStorage('azguard:core:profiles', StorageType.Session);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case ProfileServiceMethod.GetActiveProfile: {
                const _request = request as GetActiveProfileRequest;
                try {
                    const profile = await this.getActiveProfile();
                    return new GetActiveProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new GetActiveProfileResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.GetProfiles: {
                const _request = request as GetProfilesRequest;
                try {
                    const profiles = await this.getProfiles();
                    return new GetProfilesResponse(_request, profiles);
                }
                catch (error: any) {
                    return new GetProfilesResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.CreateProfile: {
                const _request = request as CreateProfileRequest;
                try {
                    const profile = await this.createProfile(_request.name, _request.password);
                    this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileAdded, profile));
                    return new CreateProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new CreateProfileResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.UnlockProfile: {
                const _request = request as UnlockProfileRequest;
                try {
                    const profile = await this.unlockProfile(_request.profileId, _request.password);
                    if (profile) {
                        this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileUnlocked, profile));
                    }
                    return new UnlockProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new UnlockProfileResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.Lock: {
                const _request = request as LockRequest;
                try {
                    await this.lock();
                    this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.Locked));
                    return new LockResponse(_request);
                }
                catch (error: any) {
                    return new LockResponse(_request);
                }
            }
            case ProfileServiceMethod.ChangeProfileName: {
                const _request = request as ChangeProfileNameRequest;
                try {
                    const profile = await this.changeProfileName(_request.profileId, _request.name);
                    if (profile) {
                        this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileUpdated, profile));
                    }
                    return new ChangeProfileNameResponse(_request, profile);
                }
                catch (error: any) {
                    return new ChangeProfileNameResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ChangeProfilePassword: {
                const _request = request as ChangeProfilePasswordRequest;
                try {
                    const profile = await this.changeProfilePassword(_request.profileId, _request.oldPassword, _request.newPassword);
                    if (profile) {
                        this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileUpdated, profile));
                    }
                    return new ChangeProfilePasswordResponse(_request, profile);
                }
                catch (error: any) {
                    return new ChangeProfilePasswordResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.DeleteProfile: {
                const _request = request as DeleteProfileRequest;
                try {
                    const profile = await this.deleteProfile(_request.profileId);
                    if (profile) {
                        this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileDeleted, profile));
                        for (const emit of this.onProfileDeleted) {
                            try {emit(profile.id)} catch {}
                        }
                    }
                    return new DeleteProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new DeleteProfileResponse(_request);
                }
            }
            case ProfileServiceMethod.ImportEncrypted: {
                const _request = request as ImportEncryptedRequest;
                try {
                    const profile = await this.importEncrypted(_request.name, _request.secret, _request.password);
                    if (profile) {
                        this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileAdded, profile));
                    }
                    return new ImportEncryptedResponse(_request, profile);
                }
                catch (error: any) {
                    return new ImportEncryptedResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ImportPlain: {
                const _request = request as ImportPlainRequest;
                try {
                    const profile = await this.importPlain(_request.name, _request.secret, _request.password);
                    this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileAdded, profile));
                    return new ImportPlainResponse(_request, profile);
                }
                catch (error: any) {
                    return new ImportPlainResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ExportEncrypted: {
                const _request = request as ExportEncryptedRequest;
                try {
                    const secret = await this.exportEncrypted(_request.profileId);
                    return new ExportEncryptedResponse(_request, secret);
                }
                catch (error: any) {
                    return new ExportEncryptedResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ExportPlain: {
                const _request = request as ExportPlainRequest;
                try {
                    const secret = await this.exportPlain(_request.profileId, _request.password);
                    return new ExportPlainResponse(_request, secret);
                }
                catch (error: any) {
                    return new ExportPlainResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async getProfiles(): Promise<Array<Profile>> {
        const records = await this.profiles.getAll();
        return records.map(([k, v]) => new Profile(k, v.name))
    }

    public async getProfile(id: string): Promise<Profile | undefined> {
        const profile = await this.profiles.get(id);
        return profile !== undefined ? new Profile(id, profile.name) : undefined;
    }

    public async createProfile(name: string, password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(encryptionGuard);
        const secret = await key.encrypt(Fr.random().toBuffer());
        
        let id: string;
        do { id = getRandomHex(8); }
        while (await this.profiles.contains(id));
        
        const profileDto = {
            name,
            guard: Buffer.from(guard.buffer).toString('base64'),
            secret: Buffer.from(secret.buffer).toString('base64'),
        };
        await this.profiles.set(id, profileDto);

        await this._openSession(id, passhash);

        return new Profile(id, name);
    }

    public async unlockProfile(id: string, password: string): Promise<Profile | undefined> {
        const profile = await this.profiles.get(id);
        if (profile !== undefined) {
            try {
                const passhash = await EncryptionKey.getPasshash(password);
                const key = await EncryptionKey.fromPasshash(passhash);
                const guard = await key.decrypt(Buffer.from(profile.guard, 'base64'));
                if (array_equals(guard, encryptionGuard)) {
                    await this._openSession(id, passhash);
                    return new Profile(id, profile.name);
                }
            }
            catch { }
        }
        return undefined;
    }

    public async readActiveProfile(): Promise<Profile | undefined> {
        const session = await this._getActiveSession();
        const day = 1000 * 60 * 60 * 24; // TODO: use settings
        if (session) {
            if (session.since > Date.now() - day) {
                const profile = await this.profiles.get(session.profile);
                if (profile !== undefined) {
                    const passhash = Buffer.from(session.passhash, 'base64');
                    const key = await EncryptionKey.fromPasshash(passhash);
                    const guard = await key.decrypt(Buffer.from(profile.guard, 'base64'));
                    if (array_equals(guard, encryptionGuard)) {
                        return new Profile(session.profile, profile.name);
                    }
                }
            }
            await this._closeSession();
        }
        return undefined;
    }

    public async getActiveProfile(): Promise<Profile | undefined> {
        const activeProfile = await this.readActiveProfile();
        if (activeProfile) await this._extendSession();
        return activeProfile;
    }

    public async getProfileSecret(id: string): Promise<Fr | undefined> {
        const session = await this._getActiveSession();
        const day = 1000 * 60 * 60 * 24; // TODO: use settings
        
        if (session?.profile === id && session.since > Date.now() - day) {
            const profile = await this.profiles.get(session.profile);
            if (profile !== undefined) {
                const passhash = Buffer.from(session.passhash, 'base64');
                const key = await EncryptionKey.fromPasshash(passhash);
                const guard = await this._tryDecrypt(Buffer.from(profile.guard, 'base64'), key);
                if (guard && array_equals(guard, encryptionGuard)) {
                    const secret = await this._tryDecrypt(Buffer.from(profile.secret, 'base64'), key);
                    if (secret) {
                        return Fr.fromBuffer(Buffer.from(secret));
                    }
                }
            }
        }
        return undefined;
    }

    public async lock(): Promise<void> {
        await this._closeSession();
    }

    public async changeProfileName(id: string, newName: string): Promise<Profile | undefined> {
        const profile = await this.profiles.get(id);
        if (profile) {
            await this.profiles.set(id, {...profile, name: newName});
            return new Profile(id, newName);
        }
        return undefined;
    }

    public async changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<Profile | undefined> {
        const activeProfile = await this.getActiveProfile();
        const profile = await this.profiles.get(id);
        if (profile) {
            const oldPasshash = await EncryptionKey.getPasshash(oldPassword);
            const oldKey = await EncryptionKey.fromPasshash(oldPasshash);
            
            const guard = await this._tryDecrypt(Buffer.from(profile.guard, 'base64'), oldKey);
            if (!guard || !array_equals(guard, encryptionGuard)) {
                throw new Error('wrong password');
            }

            const secret = await this._tryDecrypt(Buffer.from(profile.secret, 'base64'), oldKey);
            if (!secret) {
                throw new Error('storage corrupted');
            }

            const newPasshash = await EncryptionKey.getPasshash(newPassword);
            const newKey = await EncryptionKey.fromPasshash(newPasshash);
            const newGuard = await newKey.encrypt(guard);
            const newSecret = await newKey.encrypt(secret);
            
            const profileDto = {
                ...profile,
                guard: Buffer.from(newGuard.buffer).toString('base64'),
                secret: Buffer.from(newSecret.buffer).toString('base64'),
            };
            await this.profiles.set(id, profileDto);
    
            if (activeProfile?.id === id) {
                await this._openSession(id, newPasshash);
            }

            return new Profile(id, profile.name);
        }
        return undefined;
    }

    public async deleteProfile(id: string): Promise<Profile | undefined> {
        const activeProfile = await this.getActiveProfile();
        if (activeProfile?.id === id) {
            await this._closeSession();
            await this.profiles.delete(id);
            return activeProfile;
        }
        const profile = await this.getProfile(id);
        if (profile) {
            await this.profiles.delete(id);
            return profile;
        }
        return undefined;
    }

    public async importEncrypted(name: string, secret: string, password: string): Promise<Profile | undefined> {
        throw new Error('not implemented');
    }

    public async importPlain(name: string, secret: string, password: string): Promise<Profile> {
        throw new Error('not implemented');
    }

    public async exportEncrypted(id: string): Promise<string> {
        throw new Error('not implemented');
    }

    public async exportPlain(id: string, password: string): Promise<string> {
        throw new Error('not implemented');
    }

    private async _openSession(profile: string, passhash: ArrayBuffer): Promise<void> {
        const session: SessionDto = {
            profile,
            passhash: Buffer.from(passhash).toString('base64'),
            since: Date.now(),
        };
        await this.session.set('active_session', session);
        for (const emit of this.onSessionOpened) {
            try {emit(profile)} catch {}
        }
    }

    private async _extendSession(): Promise<void> {
        const session = await this.session.get('active_session');
        if (session) {
            session.since = Date.now();
            await this.session.set('active_session', session);
        }
    }

    private _getActiveSession(): Promise<SessionDto | null> {
        return this.session.get('active_session');
    }
    
    private async _closeSession(): Promise<void> {
        await this.session.delete('active_session');
        for (const emit of this.onSessionClosed) {
            try {emit()} catch {}
        }
    }

    private _tryDecrypt(payload: Uint8Array, key: EncryptionKey): Promise<Uint8Array | undefined> {
        try {
            return key.decrypt(payload);
        }
        catch {
            return Promise.resolve(undefined);
        }
    }
}