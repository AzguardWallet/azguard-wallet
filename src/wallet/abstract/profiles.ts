import { Fr } from '@aztec/foundation/fields';

export interface IProfileInfo {
    readonly id: string;
    readonly name: string;
}

export interface IProfile extends IProfileInfo {
    deriveChildSecret(chain: number, id: number): Promise<Fr>;
}

export interface IProfileManager {
    getActiveProfile(): Promise<IProfile | null>;
    getProfiles(): Promise<Array<IProfileInfo>>;
    createProfile(name: string, password: string): Promise<IProfile>;
    signInProfile(id: string, password: string): Promise<IProfile | null>;
    signOut(): Promise<void>;
    deleteProfile(profile: IProfile): Promise<void>;
    changeProfileName(profile: IProfile, newName: string | null): Promise<IProfile>;
    changeProfilePassword(profile: IProfile, newPassword: string): Promise<IProfile>;
    importEncrypted(name: string, secret: Uint8Array): Promise<void>;
    importPlain(name: string, secret: Uint8Array, password: string): Promise<void>;
    exportEncrypted(): Promise<Uint8Array>;
    exportPlain(): Promise<Uint8Array>;
}