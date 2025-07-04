import { Fr } from "@aztec/foundation/fields";
import type { RequestMessage, ResponseMessage, EventMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { SettingService } from "@/wallet/services/settings";
import type { Setting } from "@/wallet/services/settings/client";
import { DEFAULT_SETTINGS } from "@/wallet/services/settings/defaults";
import { type ILogs, LogLevel } from "@/wallet/services/logger/client";
import { EntityStorage, SimpleStorage, StorageType } from "@/wallet/storage";
import { array_equals, getRandomHex, Lock } from "@/wallet/utils";
import { getEntropy, getMnemonic } from "@/wallet/utils/mnemonic";
import { EncryptionKey } from "./encryption-key";
import {
    type ChangeProfileNameRequest,
    ChangeProfileNameResponse,
    type ChangeProfilePasswordRequest,
    ChangeProfilePasswordResponse,
    type CreateProfileRequest,
    CreateProfileResponse,
    type DeleteProfileRequest,
    DeleteProfileResponse,
    type ExportEncryptedRequest,
    ExportEncryptedResponse,
    type ExportMnemonicRequest,
    ExportMnemonicResponse,
    type ExportPlainRequest,
    ExportPlainResponse,
    type GetActiveProfileRequest,
    GetActiveProfileResponse,
    type GetProfilesRequest,
    GetProfilesResponse,
    type ImportEncryptedRequest,
    ImportEncryptedResponse,
    type ImportMnemonicRequest,
    ImportMnemonicResponse,
    type ImportPlainRequest,
    ImportPlainResponse,
    type LockActiveProfileRequest,
    LockActiveProfileResponse,
    PROFILE_SERVICE_NAME,
    Profile,
    ProfileServiceEvent,
    ProfileServiceEventMessage,
    ProfileServiceMethod,
    type RefreshSessionRequest,
    RefreshSessionResponse,
    type UnlockProfileRequest,
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

type ActiveSession = {
    profile: ProfileDto,
    session: SessionDto,
    key: EncryptionKey,
}

const encryptionGuard = new Uint8Array([6, 11, 20, 20, 22, 4, 20, 22]);

export class ProfileService extends Service {
    public readonly onProfileDeleted: ((profileId: string) => void)[] = [];
    public readonly onActiveProfileChanged: ((profileId?: string) => void)[] = [];

    private readonly profiles: EntityStorage<ProfileDto>;
    private readonly session: SimpleStorage<SessionDto>;
    private sessionTtl: number = DEFAULT_SETTINGS.session.ttl as number;
    private readonly lock = new Lock();

    private initPromise?: Promise<void>;
    private activeSession?: ActiveSession;

    constructor(
        private readonly settings: SettingService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {
        super(PROFILE_SERVICE_NAME, logger, emit);
        this.settings.onSettingUpdated.push(this.onSettingUpdated);
        this.profiles = new EntityStorage('azguard:core:profiles', StorageType.Local);
        this.session = new SimpleStorage('azguard:core:profiles', StorageType.Session);
        this.initPromise = this.initSession();
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
                    return new UnlockProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new UnlockProfileResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.LockActiveProfile: {
                const _request = request as LockActiveProfileRequest;
                try {
                    await this.lockActiveProfile();
                    return new LockActiveProfileResponse(_request);
                }
                catch (error: any) {
                    return new LockActiveProfileResponse(_request);
                }
            }
            case ProfileServiceMethod.RefreshSession: {
                const _request = request as RefreshSessionRequest;
                try {
                    await this.refreshSession();
                    return new RefreshSessionResponse(_request);
                }
                catch (error: any) {
                    return new RefreshSessionResponse(_request);
                }
            }
            case ProfileServiceMethod.ChangeProfileName: {
                const _request = request as ChangeProfileNameRequest;
                try {
                    const profile = await this.changeProfileName(_request.profileId, _request.name);
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
                    return new DeleteProfileResponse(_request, profile);
                }
                catch (error: any) {
                    return new DeleteProfileResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ImportEncrypted: {
                const _request = request as ImportEncryptedRequest;
                try {
                    const profile = await this.importEncrypted(_request.name, _request.secret, _request.password);
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
                    return new ImportPlainResponse(_request, profile);
                }
                catch (error: any) {
                    return new ImportPlainResponse(_request, undefined, error.message);
                }
            }
            case ProfileServiceMethod.ImportMnemonic: {
                const _request = request as ImportMnemonicRequest;
                try {
                    const profile = await this.importMnemonic(_request.name, _request.mnemonic, _request.password);
                    return new ImportMnemonicResponse(_request, profile);
                }
                catch (error: any) {
                    return new ImportMnemonicResponse(_request, undefined, error.message);
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
            case ProfileServiceMethod.ExportMnemonic: {
                const _request = request as ExportMnemonicRequest;
                try {
                    const mnemonic = await this.exportMnemonic(_request.profileId, _request.password);
                    return new ExportMnemonicResponse(_request, mnemonic);
                }
                catch (error: any) {
                    return new ExportMnemonicResponse(_request, undefined, error.message);
                }
            }
            default: {
                this.log(LogLevel.Error, `Invalid request method ${request.method}.`);
                // console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async getProfiles(): Promise<Array<Profile>> {
        const entries = await this.profiles.getAll();
        return entries.map(([id, profile]) => new Profile(id, profile.name))
    }

    public async createProfile(name: string, password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(encryptionGuard);
        const secret = await key.encrypt(Fr.random().toBuffer());
        try {
            await this.lock.enter();

            let id: string;
            do { id = getRandomHex(8); }
            while (await this.profiles.contains(id));
            
            const profileDto: ProfileDto = {
                name,
                guard: Buffer.from(guard.buffer).toString('base64'),
                secret: Buffer.from(secret.buffer).toString('base64'),
            };
            await this.profiles.set(id, profileDto);

            const profile = new Profile(id, name);
            this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileAdded, profile));
            
            await this.initPromise;
            await this._openSession(id, profileDto, key, passhash);

            return profile;
        }
        finally {
            this.lock.leave();
        }
    }

    public async unlockProfile(id: string, password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        try {
            await this.lock.enter();

            const profileDto = await this.profiles.get(id);
            if (!profileDto) {
                throw new Error("Invalid profile id");
            }

            const guard = await this.tryDecrypt(Buffer.from(profileDto.guard, 'base64'), key);
            if (!guard || !array_equals(guard, encryptionGuard)) {
                throw new Error("Invalid profile password");
            }

            await this.initPromise;
            await this._openSession(id, profileDto, key, passhash);

            return new Profile(id, profileDto.name);
        }
        finally {
            this.lock.leave();
        }
    }

    public async getActiveProfile(): Promise<Profile | undefined> {
        try {
            await this.lock.enter();

            const session = await this._getSession();
            return session
                ? new Profile(session.session.profile, session.profile.name)
                : undefined;
        }
        finally {
            this.lock.leave();
        }
    }

    public async getProfileSecret(id: string): Promise<Fr> {
        try {
            await this.lock.enter();

            const session = await this._getSession();
            if (session?.session.profile !== id) {
                throw new Error("Profile locked");
            }
            
            const secret = await this.tryDecrypt(Buffer.from(session.profile.secret, 'base64'), session.key);
            if (!secret) {
                throw new Error("Profile session corrupted");
            }

            return Fr.fromBuffer(Buffer.from(secret));
        }
        finally {
            this.lock.leave();
        }
    }
    
    public async lockActiveProfile(): Promise<void> {
        try {
            await this.lock.enter();

            await this.initPromise;
            await this._closeSession();
        }
        finally {
            this.lock.leave();
        }
    }

    public async refreshSession(): Promise<void> {
        try {
            await this.lock.enter();

            await this.initPromise;
            await this._refreshSession();
        }
        finally {
            this.lock.leave();
        }
    }

    public async changeProfileName(id: string, newName: string): Promise<Profile> {
        try {
            await this.lock.enter();

            const profileDto = await this.profiles.get(id);
            if (!profileDto) {
                throw new Error("Invalid profile id");
            }

            profileDto.name = newName;
            await this.profiles.set(id, profileDto);

            const profile = new Profile(id, profileDto.name);
            this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileUpdated, profile));

            await this.initPromise;
            const session = await this._getSession();
            if (session?.session.profile === id) {
                session.profile = profileDto;
            }

            return profile;
        }
        finally {
            this.lock.leave();
        }
    }

    public async changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<Profile> {
        const oldPasshash = await EncryptionKey.getPasshash(oldPassword);
        const oldKey = await EncryptionKey.fromPasshash(oldPasshash);
        try {
            await this.lock.enter();

            const profileDto = await this.profiles.get(id);
            if (!profileDto) {
                throw new Error("Invalid profile id");
            }

            const guard = await this.tryDecrypt(Buffer.from(profileDto.guard, 'base64'), oldKey);
            if (!guard || !array_equals(guard, encryptionGuard)) {
                throw new Error('Invalid profile old password');
            }

            const secret = await this.tryDecrypt(Buffer.from(profileDto.secret, 'base64'), oldKey);
            if (!secret) {
                throw new Error('Profile storage corrupted');
            }

            const newPasshash = await EncryptionKey.getPasshash(newPassword);
            const newKey = await EncryptionKey.fromPasshash(newPasshash);
            const newGuard = await newKey.encrypt(guard);
            const newSecret = await newKey.encrypt(secret);
            
            profileDto.guard = Buffer.from(newGuard.buffer).toString('base64');
            profileDto.secret = Buffer.from(newSecret.buffer).toString('base64');
            await this.profiles.set(id, profileDto);
            
            const profile = new Profile(id, profileDto.name);
            this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileUpdated, profile));

            await this.initPromise;
            const session = await this._getSession();
            if (session?.session.profile === id) {
                await this._openSession(id, profileDto, newKey, newPasshash);
            }

            return profile;
        }
        finally {
            this.lock.leave();
        }
    }

    public async deleteProfile(id: string): Promise<Profile> {
        try {
            await this.lock.enter();

            const profileDto = await this.profiles.get(id);
            if (!profileDto) {
                throw new Error("Invalid profile id");
            }

            await this.profiles.delete(id);
            
            const profile = new Profile(id, profileDto.name);
            this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileDeleted, profile));
            for (const emit of this.onProfileDeleted) {
                try {emit(id)} catch {}
            }
            
            await this.initPromise;
            const session = await this._getSession();
            if (session?.session.profile === id) {
                await this._closeSession();
            }

            return profile;
        }
        finally {
            this.lock.leave();
        }
    }

    public async importEncrypted(name: string, secret: string, password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(encryptionGuard);
        const _secret = Buffer.from(secret, "base64");
        const _plainSecret = await this.tryDecrypt(_secret, key);
        if (!_plainSecret) {
            throw new Error("Invalid password");
        }
        if (_plainSecret.byteLength !== 32) {
            throw new Error("Invalid secret length");
        }
        return await this.importProfile(name, guard, _secret, key, passhash);
    }

    public async importPlain(name: string, secret: string, password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(encryptionGuard);
        const _plainSecret = Buffer.from(secret, "base64");
        if (_plainSecret.byteLength !== 32) {
            throw new Error("Invalid secret length");
        }
        const _secret = await key.encrypt(_plainSecret);
        return await this.importProfile(name, guard, _secret, key, passhash);
    }

    public async importMnemonic(name: string, mnemonic: string[], password: string): Promise<Profile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(encryptionGuard);
        const _secret = await key.encrypt(await getEntropy(mnemonic));
        return await this.importProfile(name, guard, _secret, key, passhash);
    }

    public async exportEncrypted(id: string): Promise<string> {
        const profileDto = await this.profiles.get(id);
        if (!profileDto) {
            throw new Error("Invalid profile id");
        }
        return profileDto.secret;
    }

    public async exportPlain(id: string, password: string): Promise<string> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const profileDto = await this.profiles.get(id);
        if (!profileDto) {
            throw new Error("Invalid profile id");
        }
        const guard = await this.tryDecrypt(Buffer.from(profileDto.guard, "base64"), key);
        if (!guard || !array_equals(guard, encryptionGuard)) {
            throw new Error("Invalid profile password");
        }
        const secret = await this.tryDecrypt(Buffer.from(profileDto.secret, "base64"), key);
        if (!secret) {
            throw new Error("Profile storage corrupted");
        }
        return Buffer.from(secret).toString("base64");
    }

    public async exportMnemonic(id: string, password: string): Promise<string[]> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const profileDto = await this.profiles.get(id);
        if (!profileDto) {
            throw new Error("Invalid profile id");
        }
        const guard = await this.tryDecrypt(Buffer.from(profileDto.guard, "base64"), key);
        if (!guard || !array_equals(guard, encryptionGuard)) {
            throw new Error("Invalid profile old password");
        }
        const secret = await this.tryDecrypt(Buffer.from(profileDto.secret, "base64"), key);
        if (!secret) {
            throw new Error("Profile storage corrupted");
        }
        return await getMnemonic(secret);
    }

    private async initSession() {
        try {
            await this.lock.enter();
            
            const session = await this.session.get('active_profile');
            if (session) {
                if (session.since + this.sessionTtl > Date.now()) {
                    const profile = await this.profiles.get(session.profile);
                    if (profile) {
                        const passhash = Buffer.from(session.passhash, 'base64');
                        const key = await EncryptionKey.fromPasshash(passhash.buffer);
                        const guard = await this.tryDecrypt(Buffer.from(profile.guard, 'base64'), key);
                        if (guard && array_equals(guard, encryptionGuard)) {
                            this.log(LogLevel.Debug, "session restored");
                            // console.debug('session restored');
                            this.activeSession = {profile, session, key};
                            this.emit(new ProfileServiceEventMessage(
                                ProfileServiceEvent.ActiveProfileChanged,
                                new Profile(session.profile, profile.name)),
                            );
                            for (const emit of this.onActiveProfileChanged) {
                                try {emit(session.profile)} catch {}
                            }
                        }
                        else {
                            this.log(LogLevel.Debug, "session contains wrong credentials");
                            // console.debug('session contains wrong credentials');
                            await this._closeSession();
                        }
                    }
                    else {
                        this.log(LogLevel.Debug, "session refers wrong profile");
                        // console.debug('session refers wrong profile');
                        await this._closeSession();
                    }
                }
                else {
                    this.log(LogLevel.Debug, "session expired");
                    // console.debug('session expired');
                    await this._closeSession();
                }
            }

            const setting = await this.settings.getSetting("ttl");
            this.sessionTtl = Number(setting.value);
        }
        catch (error) {
            this.log(LogLevel.Error, ["Failed to initialize profile session", error]);
            // console.error("Failed to initialize profile session", error);
        }
        finally {
            this.lock.leave();
        }
    }
    
    private async _closeSession(): Promise<void> {
        try {
            await this.session.delete('active_profile');
            if (this.activeSession) {
                this.activeSession = undefined;
                this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ActiveProfileChanged, undefined));
                for (const emit of this.onActiveProfileChanged) {
                    try {emit(undefined)} catch {}
                }
            }
        }
        catch (error) {
            this.log(LogLevel.Error, ["Failed to close profile session", error]);
            // console.error("Failed to close profile session", error);
        }
    }

    private async _getSession(): Promise<ActiveSession | undefined> {
        if (this.activeSession) {
            if (this.activeSession.session.since + this.sessionTtl > Date.now()) {
                return this.activeSession;
            }
            else {
                this.log(LogLevel.Debug, "session expired");
                // console.debug('session expired');
                await this._closeSession();
            }
        }
        return undefined;
    }

    private async _refreshSession(): Promise<void> {
        try {
            const session = await this._getSession();
            if (session) {
                session.session.since = Date.now();
                await this.session.set('active_profile', session.session);
            }
        }
        catch (error) {
            this.log(LogLevel.Error, ["Failed to refresh profile session", error]);
            // console.error("Failed to refresh profile session", error);
        }
    }

    private async _openSession(
        profileId: string,
        profile: ProfileDto,
        key: EncryptionKey,
        passhash: ArrayBuffer,
    ): Promise<void> {
        try {
            const session: SessionDto = {
                profile: profileId,
                passhash: Buffer.from(passhash).toString('base64'),
                since: Date.now(),
            };
            await this.session.set('active_profile', session);
            this.activeSession = {profile, session, key};
            this.emit(new ProfileServiceEventMessage(
                ProfileServiceEvent.ActiveProfileChanged,
                new Profile(profileId, profile.name)),
            );
            for (const emit of this.onActiveProfileChanged) {
                try {emit(profileId)} catch {}
            }
        }
        catch (error) {
            this.log(LogLevel.Error, ["Failed to open profile session", error]);
            // console.error("Failed to open profile session", error);
        }
    }

    private async importProfile(
        name: string,
        guard: Uint8Array,
        secret: Uint8Array,
        key: EncryptionKey,
        passhash: ArrayBuffer,
    ): Promise<Profile> {
        try {
            await this.lock.enter();

            let id: string;
            do { id = getRandomHex(8); }
            while (await this.profiles.contains(id));
            
            const profileDto: ProfileDto = {
                name,
                guard: Buffer.from(guard.buffer).toString('base64'),
                secret: Buffer.from(secret.buffer).toString('base64'),
            };
            await this.profiles.set(id, profileDto);

            const profile = new Profile(id, name);
            this.emit(new ProfileServiceEventMessage(ProfileServiceEvent.ProfileAdded, profile));
            
            await this.initPromise;
            await this._openSession(id, profileDto, key, passhash);

            return profile;
        }
        finally {
            this.lock.leave();
        }
    }

    private async tryDecrypt(payload: Uint8Array, key: EncryptionKey): Promise<Uint8Array | undefined> {
        try {
            return await key.decrypt(payload);
        }
        catch (error) {
            this.log(LogLevel.Debug, ["Failed to decrypt payload", error]);
            // console.debug("Failed to decrypt payload", error);
            return undefined;
        }
    }

    private readonly onSettingUpdated = (setting: Setting) => {
        if (setting.key === "ttl" && typeof setting.value === "number") {
            this.sessionTtl = setting.value;
        }
    }
}
