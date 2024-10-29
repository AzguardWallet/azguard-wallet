import { Fr } from '@aztec/foundation/fields';
import { IProfile, IProfileInfo, IProfileManager } from '../abstract/profiles';
import { EncryptionKey } from "./encryption_key";
import { EntityStorage, SimpleStorage, StorageType } from '../storage';
import { array_equals, getRandomHex } from '../utils';
import { ProfileInfo } from './profile_info';
import { Profile } from './profile';

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

const globalGuard = new Uint8Array([6, 11, 20, 20, 22, 4, 20, 22]);

export class ProfileManager implements IProfileManager {
    private readonly profiles: EntityStorage<ProfileDto>;
    private readonly session: SimpleStorage<SessionDto>;

    constructor() {
        this.profiles = new EntityStorage('azguard:core:profiles', StorageType.Local);
        this.session = new SimpleStorage('azguard:core:profiles', StorageType.Session)
    }

    public async getProfiles(): Promise<Array<IProfileInfo>> {
        const records = await this.profiles.getAll();
        return records.map(([k, v]) => new ProfileInfo(k, v.name))
    }

    public async createProfile(name: string, password: string): Promise<IProfile> {
        const passhash = await EncryptionKey.getPasshash(password);
        const key = await EncryptionKey.fromPasshash(passhash);
        const guard = await key.encrypt(globalGuard);
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

        return new Profile(id, name, secret, key);
    }

    public async signInProfile(id: string, password: string): Promise<IProfile | null> {
        const profile = await this.profiles.get(id);
        if (profile !== null) {
            try {
                const passhash = await EncryptionKey.getPasshash(password);
                const key = await EncryptionKey.fromPasshash(passhash);
                const guard = await key.decrypt(Buffer.from(profile.guard, 'base64'));
                if (array_equals(guard, globalGuard)) {
                    await this._openSession(id, passhash);
                    return new Profile(id, profile.name, Buffer.from(profile.secret, 'base64'), key);
                }
            }
            catch { }
        }
        return null;
    }

    public async getActiveProfile(): Promise<IProfile | null> {
        const session = await this._getActiveSession();
        const day = 1000 * 60 * 60 * 24; // TODO: use settings
        if (session) {
            if (session.since > Date.now() - day) {
                const profile = await this.profiles.get(session.profile);
                if (profile !== null) {
                    const passhash = Buffer.from(session.passhash, 'base64');
                    const key = await EncryptionKey.fromPasshash(passhash);
                    const guard = await key.decrypt(Buffer.from(profile.guard, 'base64'));
                    if (array_equals(guard, globalGuard)) {
                        await this._openSession(session.profile, passhash);
                        return new Profile(session.profile, profile.name, Buffer.from(profile.secret, 'base64'), key);
                    }
                }
            }
            await this._closeSession();
        }
        return null;
    }

    public signOut(): Promise<void> {
        return this._closeSession();
    }

    public async deleteProfile(profile: IProfile): Promise<void> {
        await this._closeSession();
        return this.profiles.delete(profile.id);
    }

    public changeProfileName(profile: IProfile, newName: string | null): Promise<IProfile> {
        throw new Error('not implemented');
    }
    public changeProfilePassword(profile: IProfile, newPassword: string): Promise<IProfile> {
        throw new Error('not implemented');
    }
    public importEncrypted(name: string, secret: Uint8Array): Promise<void> {
        throw new Error('not implemented');
    }
    public importPlain(name: string, secret: Uint8Array, password: string): Promise<void> {
        throw new Error('not implemented');
    }
    public exportEncrypted(): Promise<Uint8Array> {
        throw new Error('not implemented');
    }
    public exportPlain(): Promise<Uint8Array> {
        throw new Error('not implemented');
    }

    private async _openSession(profile: string, passhash: ArrayBuffer): Promise<void> {
        const session = {
            profile,
            passhash: Buffer.from(passhash).toString('base64'),
            since: Date.now(),
        };
        await this.session.set('active_session', session);
    }

    private _getActiveSession(): Promise<SessionDto | null> {
        return this.session.get('active_session');
    }
    
    private _closeSession(): Promise<void> {
        return this.session.delete('active_session');
    }
}
