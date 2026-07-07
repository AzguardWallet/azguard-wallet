import { Fr } from "@aztec/foundation/curves/bn254";
import { ConfigProp, IConfig } from "@/wallet/config";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
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
    SENTINEL_STORAGE_KEY,
    UNKNOWN_ORIGIN,
    isCurrentGeneration,
    ProfileInfo,
    ProfileOrigin,
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

        await this.backfillOrigins();

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
        const secret = Fr.random().toBuffer() as Buffer<ArrayBuffer>;
        const encryptedSecret = await key.encrypt(secret);
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
                origin: this.currentOrigin(),
                guard: Buffer.from(guard.buffer).toString("base64"),
                secret: Buffer.from(encryptedSecret.buffer).toString("base64"),
            };
            await this.profiles.set(id, profile);

            this.emit("onProfileAdded", this.getProfileInfo(profile));

            await this._openSession(id, profile, secret, passhash);

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
            const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
            if (!secret) {
                throw new Error("Profile storage corrupted");
            }

            await this._openSession(id, profile, secret, passhash);

            return this.getProfileInfo(profile);
        } finally {
            this.lock.leave();
        }
    }

    public async createPasskeyProfile(name: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        // First we make unique id without a lock to avoid deadlocks during UI query:
        let id: string;
        do {
            id = getRandomHex(8);
        } while (await this.profiles.contains(id));
        const credential = await this.passkeys.createKey(id);
        const secret = await credential.deriveMasterSecret();

        try {
            await this.lock.enter();
            // Then we also protect against collision, which should be very unlikely:
            while (await this.profiles.contains(id)) {
                id = getRandomHex(8);
            }

            const profile: Profile = {
                id,
                name,
                type: "passkey",
                origin: this.currentOrigin(),
                credentialId: credential.id,
            };
            await this.profiles.set(id, profile);

            this.emit("onProfileAdded", this.getProfileInfo(profile));

            await this._openSession(id, profile, secret);

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
            const secret = await credential.deriveMasterSecret();

            await this._openSession(id, profile, secret);

            return this.getProfileInfo(profile);
        } finally {
            this.lock.leave();
        }
    }

    public async importPasskey(name: string): Promise<ProfileInfo> {
        await this.ensureInitialized();
        const credential = await this.passkeys.getKey();
        const secret = await credential.deriveMasterSecret();
        return await this.importPasskeyProfile(name, credential.id, secret, credential.userHandle);
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
                await this._openSession(id, profile, secret, newPasshash);
            }

            return profile;
        } finally {
            this.lock.leave();
        }
    }

    public async confirmProfileOperation(id: string, password?: string): Promise<boolean> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();

            const profile = await this.profiles.get(id);
            if (!profile) {
                throw new Error("Invalid profile id");
            }

            if (profile.type === "password") {
                if (!password) {
                    throw new Error("Password is required");
                }

                const passhash = await EncryptionKey.getPasshash(password);
                const key = await EncryptionKey.fromPasshash(passhash);

                const guard = await this.tryDecrypt(Buffer.from(profile.guard, "base64"), key);
                if (!guard || !array_equals(guard, ENCRYPTION_GUARD)) {
                    throw new Error("Invalid profile password");
                }
                const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);
                if (!secret) {
                    throw new Error("Profile storage corrupted");
                }
            } else {
                if (!profile.credentialId) {
                    throw new Error("Missing credentialId");
                }

                const credential = await this.passkeys.getKey(profile.credentialId);

                if (!credential) {
                    throw new Error("Failed to get passkey credential");
                }
            }

            return true;
        } catch (error) {
            this.logError("Failed to confirm operation", getErrorMessage(error));
            throw new Error(getErrorMessage(error));
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

    public async exportPlain(id: string, password?: string): Promise<string> {
        await this.ensureInitialized();
        const profile = await this.profiles.get(id);
        if (!profile) {
            throw new Error("Invalid profile id");
        }

        await this.confirmProfileOperation(id, password);

        let plainSecret = "";
        if (profile.type === "password" && password) {
            const passhash = await EncryptionKey.getPasshash(password);
            const key = await EncryptionKey.fromPasshash(passhash);
            const secret = await this.tryDecrypt(Buffer.from(profile.secret, "base64"), key);

            plainSecret = Buffer.from(secret!).toString("base64");
        } else if (profile.type === "passkey") {
            plainSecret = profile.credentialId;
        }

        return plainSecret;
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
        if (profile.type === "passkey") {
            this.logDebug("Restore password session called with passkey profile");
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
        this.logDebug("Session restored");
        this.activeSession = { profile, session, secret: Fr.fromBuffer(Buffer.from(secretBytes)) };
    }

    private async _openSession(
        profileId: string,
        profile: Profile,
        secretBuffer: Uint8Array<ArrayBuffer>,
        passhash?: ArrayBuffer,
    ) {
        try {
            const session: Session = {
                profile: profileId,
                passhash: passhash ? Buffer.from(passhash).toString("base64") : undefined,
                since: Date.now(),
            };
            await this.session.set(session);
            const secret = Fr.fromBuffer(Buffer.from(secretBuffer));
            this.activeSession = { profile, session, secret };
            this.emit("onActiveProfileChanged", this.getProfileInfo(profile));
        } catch (error) {
            this.logError("Failed to open profile session", getErrorMessage(error));
        }
    }

    private async importPasswordProfile(
        name: string,
        secret: Uint8Array<ArrayBuffer>,
        passhash: ArrayBuffer,
    ): Promise<Profile> {
        try {
            await this.lock.enter();
            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.profiles.contains(id));
            const key = await EncryptionKey.fromPasshash(passhash);
            const guard = await key.encrypt(ENCRYPTION_GUARD);
            const encodedSecret = await key.encrypt(secret);
            const profile: Profile = {
                id,
                name,
                type: "password",
                origin: this.currentOrigin(),
                guard: Buffer.from(guard.buffer).toString("base64"),
                secret: Buffer.from(encodedSecret.buffer).toString("base64"),
            };
            await this.profiles.set(id, profile);
            this.emit("onProfileAdded", this.getProfileInfo(profile));
            await this._openSession(id, profile, secret, passhash);
            return profile;
        } finally {
            this.lock.leave();
        }
    }

    private async importPasskeyProfile(
        name: string,
        credentialId: string,
        secret: Uint8Array<ArrayBuffer>,
        userHandle?: string,
    ): Promise<Profile> {
        try {
            await this.lock.enter();
            if (userHandle && (await this.profiles.contains(userHandle))) {
                throw new Error("Passkey profile already exists");
            }

            // It is unclear if this case is possible, this is a fallback:
            if (!userHandle) {
                do {
                    userHandle = getRandomHex(8);
                } while (await this.profiles.contains(userHandle));
            }

            let id = userHandle;
            const profile: Profile = {
                id,
                name,
                type: "passkey",
                origin: this.currentOrigin(),
                credentialId,
            };
            await this.profiles.set(id, profile);
            this.emit("onProfileAdded", this.getProfileInfo(profile));
            await this._openSession(id, profile, secret);
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
        return { id: profile.id, name: profile.name, type: profile.type, origin: profile.origin };
    }

    private currentOrigin(): ProfileOrigin {
        return { sentinel: __SENTINEL__, walletVersion: __VERSION__, aztecVersion: __AZTEC_VERSION__ };
    }

    /**
     * Migration: profiles created before origin tracking get stamped once at startup.
     * Their epoch is the global sentinel recorded by the last register/import; the build
     * versions are unknowable by then. Runs before setSentinel can overwrite the global
     * value, and normally finds nothing — but must stay for installs that skip many
     * versions at once (extension updates can jump straight from any old build).
     */
    private async backfillOrigins() {
        const legacy = (await this.profiles.getValues()).filter((p) => !p.origin);
        if (!legacy.length) {
            return;
        }
        const sentinel: string = (await chrome.storage.local.get(SENTINEL_STORAGE_KEY))[SENTINEL_STORAGE_KEY] ?? UNKNOWN_ORIGIN.sentinel;
        for (const profile of legacy) {
            await this.profiles.set(profile.id, { ...profile, origin: { ...UNKNOWN_ORIGIN, sentinel } });
            this.logDebug(`Backfilled origin for profile ${profile.id}, sentinel: ${sentinel}`);
        }
    }

    private readonly onConfigUpdated = (prop: ConfigProp) => {
        if (prop.key === "sessionTtl") {
            this.sessionTtl = prop.value;
        }
    };

    public async backup(): Promise<ProfileInfo | undefined> {
        return (await this.getActiveProfile());
    }

    /**
     * Refuses backups from another profile generation (backstop behind the import UI's own check)
     * and keeps the origin the profile was created with — never stamps the current build's.
     */
    public async restore(profile: ProfileInfo, masterKey: string, password?: string): Promise<Restored<ProfileInfo>> {
        await this.ensureInitialized();

        if (!masterKey) {
            throw new Error("Master key is required to restore profile");
        }

        if (!isCurrentGeneration(profile.origin)) {
            return {
                ...profile,
                restoreError: profile.origin
                    ? "Backup profile is from an incompatible generation"
                    : "Backup predates profile versioning",
            };
        }

        const profileNames = (await this.profiles.getValues()).map(p => p.name);
        let base = profile.name;
        let name = base;
        let counter = 1;
        while (profileNames.includes(name)) {
            name = `${base} ${counter}`;
            counter++;
        }

        switch (profile.type) {
            case "password": {
                if (!password) {
                    throw new Error("Password is required for password profile");
                }

                const plainSecret = Buffer.from(masterKey, "base64");
                if (plainSecret.byteLength !== 32) {
                    throw new Error("Invalid master key length");
                }

                const passhash = await EncryptionKey.getPasshash(password);
                const key = await EncryptionKey.fromPasshash(passhash);
                const guard = await key.encrypt(ENCRYPTION_GUARD);
                const encodedSecret = await key.encrypt(plainSecret);
                try {
                    await this.lock.enter();

                    let id = profile.id;
                    while ((await this.profiles.contains(id))) {
                        id = getRandomHex(8);
                    }

                    const newProfile: Profile = {
                        id,
                        name,
                        type: "password",
                        origin: profile.origin,
                        guard: Buffer.from(guard.buffer).toString("base64"),
                        secret: Buffer.from(encodedSecret.buffer).toString("base64"),
                    };

                    await this.profiles.set(id, newProfile);

                    this.emit("onProfileAdded", this.getProfileInfo(newProfile));

                    return this.getProfileInfo(newProfile);
                } catch (err) {
                    return {
                        ...profile,
                        restoreError: err instanceof Error ? err.message : err,
                    };
                } finally {
                    this.lock.leave();
                }
            }
            case "passkey": {
                try {
                    const credential = await this.passkeys.getKey(masterKey);
                    let id = credential.userHandle;

                    await this.lock.enter();
                    if (id && (await this.profiles.contains(id))) {
                        throw new Error("Passkey profile already exists");
                    }

                    // It is unclear if this case is possible, this is a fallback:
                    if (!id) {
                        do {
                            id = getRandomHex(8);
                        } while (await this.profiles.contains(id));
                    }

                    const newProfile: Profile = {
                        id,
                        name,
                        type: "passkey",
                        origin: profile.origin,
                        credentialId: credential.id,
                    };
                    await this.profiles.set(id, newProfile);

                    this.emit("onProfileAdded", this.getProfileInfo(newProfile));

                    return this.getProfileInfo(newProfile);
                } catch (err) {
                    return {
                        ...profile,
                        restoreError: err instanceof Error ? err.message : err,
                    }
                } finally {
                    this.lock.leave();
                }
            }

            default:
                throw new Error("Unknown profile type");
        }
    }
}
