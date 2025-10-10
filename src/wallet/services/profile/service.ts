import { Fr } from "@aztec/foundation/fields";
import { ConfigProp, IConfig } from "@/wallet/config";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { EntityStorage, StorageType, ValueStorage } from "@/wallet/storage";
import { array_equals, getRandomHex, Lock } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { EventHandler } from "@/wallet/utils/event-handler";
import { getEntropy, getMnemonic } from "@/wallet/utils/mnemonic";
import { EncryptionKey } from "./encryption/encryption-key";
import { PasskeyService } from "@/wallet/services/passkey/service";
import {
    PROFILE_SERVICE_NAME,
    ENCRYPTION_GUARD,
    ProfileInfo,
    Profile,
    Session,
    ActiveSession,
    Events,
    Methods,
} from "./spec";

export * from "./spec";

export class ProfileService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = PROFILE_SERVICE_NAME;

    public readonly onProfileAdded = new EventHandler<ProfileInfo>();
    public readonly onProfileUpdated = new EventHandler<ProfileInfo>();
    public readonly onProfileDeleted = new EventHandler<ProfileInfo>();
    public readonly onActiveProfileChanged = new EventHandler<ProfileInfo | undefined>();

    private readonly lock = new Lock();
    private readonly profiles: EntityStorage<Profile>;
    private readonly session: ValueStorage<Session>;
    private sessionTtl: number;
    private passkeys: PasskeyService = null!;

    private activeSession?: ActiveSession;

    public constructor(config: IConfig, logger: ILogger) {
        super(PROFILE_SERVICE_NAME, logger);
        this.profiles = new EntityStorage("azguard:core:profiles", StorageType.Local);
        this.session = new ValueStorage("azguard:core:session", StorageType.Session);
        this.sessionTtl = config.get("sessionTtl");
        config.onUpdate.add(this.onConfigUpdated);
    }

    protected async init(services: ServiceCollection) {
        this.passkeys = services.get(PasskeyService.name);

        // TODO: remove this at some point
        // migration
        const entries = await this.profiles.getAll();
        if (entries.some(x => x[0] !== x[1].id)) {
            this.logInfo("Migrate profiles");
            for (const [id, profile] of entries) {
                profile.id = id;
                await this.profiles.set(id, profile);
            }
        }

        if (entries.some(x => x[1].type === undefined)) {
            this.logInfo("Migrate profiles: adding type for password profiles");
            for (const [id, profile] of entries) {
                if ((profile as { type?: unknown }).type === undefined) {
                    profile.type = "password";
                    await this.profiles.set(id, profile);
                }
            }
        }

        const session = await this.session.get();
        if (!session) {
            return;
        }
        if (session.since + this.sessionTtl <= Date.now() && this.sessionTtl !== 0) {
            this.logDebug("Session expired");
            await this._closeSession();
            return;
        }
        const profile = await this.profiles.get(session.profile);
        if (!profile) {
            this.logDebug("Session refers wrong profile");
            await this._closeSession();
            return;
        }
        if (profile.type === "password") {
            await this.restorePasswordSession(session, profile);
        } else {
            // TODO: should we restore passkey session here or we should show auth modal instead?
            this.logInfo("Going to restore passkey session");
            await this.restorePasskeySession(session, profile);
        }
    }

    public async getActiveProfile(): Promise<ProfileInfo | undefined> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const session = await this._getSession();
            return session ? this.getProfileInfo(session.profile) : undefined;
        } finally {
            this.lock.leave();
        }
    }

    public async getProfiles(): Promise<ProfileInfo[]> {
        await this.ensureInitialized();
        return (await this.profiles.getValues()).map(this.getProfileInfo);
    }

    public async createProfile(name: string, password: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(ENCRYPTION_GUARD);
        const secret = await key.encrypt(Fr.random().toBuffer() as Buffer<ArrayBuffer>);
        try {
            await this.lock.enter();

            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.profiles.contains(id));

            const profile: Profile = {
                id,
                name,
                type: "password",
                guard: Buffer.from(guard.buffer).toString("base64"),
                secret: Buffer.from(secret.buffer).toString("base64"),
            };
            await this.profiles.set(id, profile);

            this.emit("onProfileAdded", this.getProfileInfo(profile));

            await this._openPasswordSession(id, profile, passhash);

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async unlockProfile(id: string, password: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }
            if (profile.type === "passkey") {
                throw new Error("Profile requires passkey");
            }

            const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), key);
            if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
                throw new Error("Invalid profile password");
            }

            await this._openPasswordSession(id, profile, passhash);

            return this.getProfileInfo(profile);
        } finally {
            this.lock.leave();
        }
    }

    public async createPasskeyProfile(name: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const credential = await this.passkeys.createKey();
        const master = await credential.deriveMasterSecret();
        try {
            await this.lock.enter();

            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.profiles.contains(id));

            const profile: Profile = {
                id,
                name,
                type: "passkey",
                credentialId: credential.id,
            };
            await this.profiles.set(id, profile);

            this.emit("onProfileAdded", this.getProfileInfo(profile));

            await this._openPasskeySession(id, profile, master);

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async unlockPasskeyProfile(id: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }
            if (profile.type === "password") {
                throw new Error("Profile requires password");
            }
            if (!profile.credentialId) {
                throw new Error("Missing credentialId");
            }

            const credential = await this.passkeys.getKey(profile.credentialId);
            const master = await credential.deriveMasterSecret();

            await this._openPasskeySession(id, profile, master);

            return this.getProfileInfo(profile);
        } finally {
            this.lock.leave();
        }
    }

    public async importPasskey(name: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const credential = await this.passkeys.getKey();
        const master = await credential.deriveMasterSecret();
        return await this.importPasskeyProfile(name, credential.id, master);
    }

    public async lockActiveProfile(): Promise<void> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();
            await this._closeSession();
        } finally {
            this.lock.leave();
        }
    }

    public async refreshSession(): Promise<void> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();
            await this._refreshSession();
        } finally {
            this.lock.leave();
        }
    }

    public async changeProfileName(id: string, newName: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }

            profile.name = newName;
            await this.profiles.set(id, profile);

            this.emit("onProfileUpdated", this.getProfileInfo(profile));

            const session = await this._getSession();
            if (session?.session.profile === id) {
                session.profile = profile;
            }

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const oldPasshash = await EncryptionKey.getPasshash(oldPassword);
        const oldKey = await EncryptionKey.fromPasshash(oldPasshash);
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }
            if (profile.type === "passkey") {
                throw new Error("Operation not supported for passkey profile");
            }

            const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), oldKey);
            if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
                throw new Error("Invalid profile old password");
            }

            const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), oldKey);
            if (!secret) {
                throw new Error("Profile storage corrupted");
            }

            const newPasshash = await EncryptionKey.getPasshash(newPassword);
            const newKey = await EncryptionKey.fromPasshash(newPasshash);
            const newGuard = await newKey.encrypt(guard);
            const newSecret = await newKey.encrypt(secret);

            profile.guard = Buffer.from(newGuard.buffer).toString("base64");
            profile.secret = Buffer.from(newSecret.buffer).toString("base64");
            await this.profiles.set(id, profile);

            this.emit("onProfileUpdated", this.getProfileInfo(profile));

            const session = await this._getSession();
            if (session?.session.profile === id) {
                await this._openPasswordSession(id, profile, newPasshash);
            }

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteProfile(id: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }

            await this.profiles.delete(id);

            this.emit("onProfileDeleted", this.getProfileInfo(profile));

            const session = await this._getSession();
            if (session?.session.profile === id) {
                await this._closeSession();
            }

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async importEncrypted(name: string, secret: string, password: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const _secret = Buffer.from(secret, "base64");
        const key = await EncryptionKey.fromPasshash(passhash);
        const _plainSecret = await this.tryDecrypt(_secret, key);
        if (!_plainSecret) {
            throw new Error("Invalid password");
        }
        if (_plainSecret.byteLength !== 32) {
            throw new Error("Invalid secret length");
        }
        return await this.importPasswordProfile(name, _plainSecret, passhash);
    }

    public async importPlain(name: string, secret: string, password: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const _plainSecret = Buffer.from(secret, "base64");
        if (_plainSecret.byteLength !== 32) {
            throw new Error("Invalid secret length");
        }
        return await this.importPasswordProfile(name, _plainSecret, passhash);
    }

    public async importMnemonic(name: string, mnemonic: string[], password: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const plain = await getEntropy(mnemonic);
        return await this.importPasswordProfile(name, plain, passhash);
    }

    public async exportEncrypted(id: string): Promise<string> {
        await this.ensureInitialized();
        const profile = await this.profiles.get(id);
        if (!profile) {
            throw new Error("Invalid profile id");
        }
        if (profile.type === "passkey") {
            throw new Error("Operation not supported for passkey profile");
        }
        return profile.secret;
    }

    public async exportPlain(id: string, password: string): Promise<string> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const profile = await this.profiles.get(id);
        if (!profile) {
            throw new Error("Invalid profile id");
        }
        if (profile.type === "passkey") {
            throw new Error("Operation not supported for passkey profile");
        }
        const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), key);
        if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
            throw new Error("Invalid profile password");
        }
        const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
        if (!secret) {
            throw new Error("Profile storage corrupted");
        }
        return Buffer.from(secret).toString("base64");
    }

    public async exportMnemonic(id: string, password: string): Promise<string[]> {
        await this.ensureInitialized();
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const profile = await this.profiles.get(id);
        if (!profile) {
            throw new Error("Invalid profile id");
        }
        if (profile.type === "passkey") {
            throw new Error("Operation not supported for passkey profile");
        }
        const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), key);
        if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
            throw new Error("Invalid profile old password");
        }
        const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
        if (!secret) {
            throw new Error("Profile storage corrupted");
        }
        return await getMnemonic(secret);
    }

    public async getProfileSecret(id: string): Promise<Fr> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const session = await this._getSession();
            if (session?.session.profile !== id) {
                throw new Error("Profile locked");
            }

            return session.secret;
        } finally {
            this.lock.leave();
        }
    }

    private async _getSession(): Promise<ActiveSession | undefined> {
        if (!this.activeSession) {
            return undefined;
        }
        if (this.activeSession.session.since + this.sessionTtl <= Date.now() && this.sessionTtl !== 0) {
            this.logDebug("Session expired");
            await this._closeSession();
            return undefined;
        }
        return this.activeSession;
    }

    private async _closeSession() {
        try {
            await this.session.delete();
            if (this.activeSession) {
                this.activeSession = undefined;
                this.emit("onActiveProfileChanged", undefined);
            }
        } catch (error) {
            this.logError("Failed to close profile session", getErrorMessage(error));
        }
    }

    private async _refreshSession() {
        try {
            const session = await this._getSession();
            if (session) {
                session.session.since = Date.now();
                await this.session.set(session.session);
            }
        } catch (error) {
            this.logError("Failed to refresh profile session", getErrorMessage(error));
        }
    }

    private async restorePasswordSession(session: Session, profile: Profile) {
        if (!session.passhash) {
            this.logDebug("Password session missing passhash");
            await this._closeSession();
            return;
        }
        if (profile.type !== "password") {
            this.logDebug("Restore password session called with non-password profile");
            await this._closeSession();
            return;
        }
        const passhash = Buffer.from(session.passhash, "base64");
        const key = await EncryptionKey.fromPasshash(passhash.buffer);
        const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), key);
        if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
            this.logDebug("Session contains wrong credentials");
            await this._closeSession();
            return;
        }
        const secretBytes = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
        if (!secretBytes) {
            this.logDebug("Failed to decrypt password secret on restore");
            await this._closeSession();
            return;
        }
        this.logDebug("Session restored (password)");
        this.activeSession = { profile, session, secret: Fr.fromBuffer(Buffer.from(secretBytes)) };
    }

    private async restorePasskeySession(session: Session, profile: Profile) {
        if (profile.type !== "passkey") {
            this.logDebug("Restore passkey session called with non-passkey profile");
            await this._closeSession();
            return;
        }
        if (!profile.credentialId) {
            this.logDebug("Passkey session missing credentialId");
            await this._closeSession();
            return;
        }
        const credential = await this.passkeys.getKey(profile.credentialId);
        const master = await credential.deriveMasterSecret();
        this.logDebug("Session restored (passkey)");
        // TODO: should `deriveMasterSecret` return Fr instead of Buffer?
        this.activeSession = { profile, session, secret: Fr.fromBuffer(Buffer.from(master)) };
    }

    private async _openPasswordSession(profileId: string, profile: Profile, passhash: ArrayBuffer) {
        try {
            const session: Session = {
                profile: profileId,
                passhash: Buffer.from(passhash).toString("base64"),
                since: Date.now(),
            };
            await this.session.set(session);
            if (profile.type !== "password") {
                throw new Error("Expected password profile");
            }
            const key = await EncryptionKey.fromPasshash(passhash);
            const secretBytes = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
            if (!secretBytes) {
                throw new Error("Profile storage corrupted");
            }
            this.activeSession = { profile, session, secret: Fr.fromBuffer(Buffer.from(secretBytes)) };
            this.emit("onActiveProfileChanged", this.getProfileInfo(profile));
        } catch (error) {
            this.logError("Failed to open profile session", getErrorMessage(error));
        }
    }

    private async _openPasskeySession(profileId: string, profile: Profile, master: Uint8Array<ArrayBuffer>) {
        try {
            const session: Session = {
                profile: profileId,
                since: Date.now(),
            };
            await this.session.set(session);
            this.activeSession = { profile, session, secret: Fr.fromBuffer(Buffer.from(master)) };
            this.emit("onActiveProfileChanged", this.getProfileInfo(profile));
        } catch (error) {
            this.logError("Failed to open profile session", getErrorMessage(error));
        }
    }

    private async importPasswordProfile(name: string, secretPlain: Uint8Array<ArrayBuffer>, passhash: ArrayBuffer): Promise<Profile> {
        try {
            await this.lock.enter();
            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.profiles.contains(id));
            const key = await EncryptionKey.fromPasshash(passhash);
            const guard = await key.encrypt(ENCRYPTION_GUARD);
            const secretEnc = await key.encrypt(secretPlain);
            const profile: Profile = {
                id,
                name,
                type: "password",
                guard: Buffer.from(guard.buffer).toString("base64"),
                secret: Buffer.from(secretEnc.buffer).toString("base64"),
            };
            await this.profiles.set(id, profile);
            this.emit("onProfileAdded", this.getProfileInfo(profile));
            await this._openPasswordSession(id, profile, passhash);
            return profile;
        } finally {
            this.lock.leave();
        }
    }

    private async importPasskeyProfile(name: string, credentialId: string, master: Uint8Array<ArrayBuffer>): Promise<Profile> {
        try {
            await this.lock.enter();
            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.profiles.contains(id));
            const profile: Profile = {
                id,
                name,
                type: "passkey",
                credentialId,
            };
            await this.profiles.set(id, profile);
            this.emit("onProfileAdded", this.getProfileInfo(profile));
            await this._openPasskeySession(id, profile, master);
            return profile;
        } finally {
            this.lock.leave();
        }
    }

    private async tryDecrypt(
        payload: Uint8Array<ArrayBuffer>,
        key: EncryptionKey,
    ): Promise<Uint8Array<ArrayBuffer> | undefined> {
        try {
            return await key.decrypt(payload);
        } catch (error) {
            this.logDebug("Failed to decrypt payload", getErrorMessage(error));
            return undefined;
        }
    }

    private getProfileInfo(profile: Profile): ProfileInfo {
        return { id: profile.id, name: profile.name, type: profile.type } as ProfileInfo;
    }

    private readonly onConfigUpdated = (prop: ConfigProp) => {
        if (prop.key === "sessionTtl") {
            this.sessionTtl = prop.value;
        }
    };
}
