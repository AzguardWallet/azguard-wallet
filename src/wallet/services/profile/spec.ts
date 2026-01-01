import type { Fr } from "@aztec/foundation/curves/bn254";

export const PROFILE_SERVICE_NAME = "profile";

export const ENCRYPTION_GUARD = new Uint8Array([6, 11, 20, 20, 22, 4, 20, 22]);

export type ProfileType = "password" | "passkey";

export type ProfileInfo = {
    /** Randomly generated id. */
    id: string;
    /** Display name. */
    name: string;
    /** Profile type. */
    type: ProfileType;
};

export type Profile = ProfileInfo &
    (
        | {
              type: "password";
              guard: string;
              secret: string;
          }
        | {
              type: "passkey";
              credentialId: string;
          }
    );

export type Session = {
    /** Profile id. */
    profile: string;
    /** Profile passhash. */
    passhash?: string;
    /** Creation time */
    since: number;
};

export type ActiveSession = {
    /** Profile object*/
    profile: Profile;
    /** Session object */
    session: Session;
    /** Master secret */
    secret: Fr;
};

export type Methods = {
    /**
     * Returns a profile for which an active session exists, or undefined otherwise.
     */
    getActiveProfile(): ProfileInfo | undefined;

    /**
     * Returns a list of profiles.
     */
    getProfiles(): ProfileInfo[];

    /**
     * Creates and returns a new profile.
     * @param name Display name.
     * @param password Password for storage encryption.
     */
    createProfile(name: string, password: string): ProfileInfo;

    /**
     * Creates and returns a new passkey-backed profile.
     * @param name Display name.
     */
    createPasskeyProfile(name: string): ProfileInfo;

    /**
     * Unlocks a profile with the specified id.
     * @param id Profile id.
     * @param password Profile password.
     */
    unlockProfile(id: string, password: string): ProfileInfo;

    /**
     * Unlocks a passkey-backed profile with the specified id.
     * @param id Profile id.
     */
    unlockPasskeyProfile(id: string): ProfileInfo;

    /**
     * Locks active profile, closing active session.
     */
    lockActiveProfile(): void;

    /**
     * Resets expiration of active session.
     */
    refreshSession(): void;

    /**
     * Changes profile name and returns the updated profile.
     * @param id Profile id.
     * @param newName New display name.
     */
    changeProfileName(id: string, newName: string): ProfileInfo;

    /**
     * Changes profile password and returns the updated profile.
     * @param id Profile id.
     * @param oldPassword Old password, to decrypt storage.
     * @param newPassword New password, to encrypt storage.
     */
    changeProfilePassword(id: string, oldPassword: string, newPassword: string): ProfileInfo;

    /**
     * Deletes a profile and returns the deleted profile.
     * @param id Profile id.
     */
    deleteProfile(id: string): ProfileInfo;

    /**
     * Imports profile from encrypted secret and signs in.
     * @param name Display name.
     * @param secret Encrypted secret (base64).
     * @param password Password to decrypt (and then encrypt) the secret.
     */
    importEncrypted(name: string, secret: string, password: string): ProfileInfo;

    /**
     * Imports profile from plain secret and signs in.
     * @param name Display name.
     * @param secret Plain secret (base64).
     * @param password Password to encrypt the secret.
     */
    importPlain(name: string, secret: string, password: string): ProfileInfo;

    /**
     * Imports a passkey-backed profile using an existing credential and signs in.
     * @param name Display name.
     */
    importPasskey(name: string): ProfileInfo;

    /**
     * Imports profile from 24-words mnemonic phrase, representing plain secret, and signs in.
     * @param name Display name.
     * @param words 24-words mnemonic phrase.
     * @param password Password to encrypt the secret.
     */
    importMnemonic(name: string, mnemonic: string[], password: string): ProfileInfo;

    /**
     * Returns encrypted profile secret (base64).
     * @param id Profile id.
     */
    exportEncrypted(id: string): string;

    /**
     * Returns plain profile secret (base64).
     * @param id Profile id.
     * @param password Password to decrypt the secret.
     */
    exportPlain(id: string, password: string): string;

    /**
     * Returns 24-words mnemonic phrase, representing plain profile secret.
     * @param id Profile id.
     * @param password Password to decrypt the secret.
     */
    exportMnemonic(id: string, password: string): string[];
};

export type Events = {
    /** Emitted when a new profile is created. */
    onProfileAdded: ProfileInfo;
    /** Emitted when an existing profile is updated. */
    onProfileUpdated: ProfileInfo;
    /** Emitted when an existing profile is deleted. */
    onProfileDeleted: ProfileInfo;
    /** Emitted when an active profile is changed. */
    onActiveProfileChanged: ProfileInfo | undefined;
};
