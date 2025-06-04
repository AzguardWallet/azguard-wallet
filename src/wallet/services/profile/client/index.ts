import type { EventMessage } from '@/wallet/base/port-service/messages';
import { ServiceClient } from '@/wallet/base/port-service/service-client';
import { ProfileServiceEvent, type ProfileServiceEventMessage } from './events';
import {
    ChangeProfileNameRequest,
    ChangeProfilePasswordRequest,
    CreateProfileRequest,
    DeleteProfileRequest,
    ExportEncryptedRequest,
    ExportMnemonicRequest,
    ExportPlainRequest,
    GetActiveProfileRequest,
    GetProfilesRequest,
    ImportEncryptedRequest,
    ImportMnemonicRequest,
    ImportPlainRequest,
    LockActiveProfileRequest,
    RefreshSessionRequest,
    UnlockProfileRequest
} from './methods';
import type { Profile } from './models';

export * from './events';
export * from './methods';
export * from './models';

export const PROFILE_SERVICE_NAME = "profile";

/**
 * Client for interaction with the ProfileService via messaging API
 */
export class ProfileServiceClient extends ServiceClient {
    /**
     * Creates ProfileServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onProfileAdded Callback, called when a new profile was created.
     * @param onProfileUpdated Callback, called when an existing profile was updated.
     * @param onProfileDeleted Callback, called when an existing profile was deleted.
     * @param onActiveProfileChanged Callback, called when an active profile was changed.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onProfileAdded?: (profile: Profile) => void,
        private readonly onProfileUpdated?: (profile: Profile) => void,
        private readonly onProfileDeleted?: (profile: Profile) => void,
        private readonly onActiveProfileChanged?: (profile?: Profile) => void,
    ) {
        super(PROFILE_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case ProfileServiceEvent.ProfileAdded:
                if (this.onProfileAdded) {
                    try {this.onProfileAdded((message as ProfileServiceEventMessage).profile!);}
                    catch {}
                }
                break;
            case ProfileServiceEvent.ProfileUpdated:
                if (this.onProfileUpdated) {
                    try {this.onProfileUpdated((message as ProfileServiceEventMessage).profile!);}
                    catch {}
                }
                break;
            case ProfileServiceEvent.ProfileDeleted:
                if (this.onProfileDeleted) {
                    try {this.onProfileDeleted((message as ProfileServiceEventMessage).profile!);}
                    catch {}
                }
                break;
            case ProfileServiceEvent.ActiveProfileChanged:
                if (this.onActiveProfileChanged) {
                    try {this.onActiveProfileChanged((message as ProfileServiceEventMessage).profile);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }
    
    /**
     * If there is an active session, returns an unlocked profile, or undefined otherwise.
     * @emits `ActiveProfileChanged` with undefined profile, if active session has expired.
     */
    public getActiveProfile(): Promise<Profile | undefined> {
        return this.request(new GetActiveProfileRequest());
    }

    /**
     * Returns a list of profiles.
     */
    public getProfiles(): Promise<Array<Profile>> {
        return this.request(new GetProfilesRequest());
    }

    /**
     * Creates and returns a new profile.
     * @param name Display name.
     * @param password Password for storage encryption.
     * @emits `ProfileAdded` with created profile.
     * @emits `ActiveProfileChanged` with created profile.
     */
    public createProfile(name: string, password: string): Promise<Profile> {
        return this.request(new CreateProfileRequest(name, password));
    }

    /**
     * Unlocks a profile with the specified id.
     * @param id Profile id.
     * @param password Profile password.
     * @emits `ActiveProfileChanged` with unlocked profile.
     * @throws "Invalid profile id" if profile doesn't exist.
     * @throws "Invalid profile password" if password is invalid.
     */
    public unlockProfile(id: string, password: string): Promise<Profile> {
        return this.request(new UnlockProfileRequest(id, password));
    }

    /**
     * Locks active profile, closing active session.
     * @emits `ActiveProfileChanged` with undefined profile.
     */
    public lockActiveProfile(): Promise<void> {
        return this.request(new LockActiveProfileRequest());
    }

    /**
     * Resets expiration of active session.
     * @emits `ActiveProfileChanged` with undefined profile, if active session has already expired.
     */
    public refreshSession(): Promise<void> {
        return this.request(new RefreshSessionRequest());
    }

    /**
     * Changes profile name and returns the updated profile.
     * @param id Profile id.
     * @param name New display name.
     * @emits `ProfileUpdated` with updated profile.
     * @emits `ActiveProfileChanged` with undefined profile, if active session has expired.
     * @throws "Invalid profile id" if profile doesn't exist.
     */
    public changeProfileName(id: string, name: string): Promise<Profile> {
        return this.request(new ChangeProfileNameRequest(id, name));
    }

    /**
     * Changes profile password and returns the updated profile.
     * @param id Profile id.
     * @param oldPassword Old password, to decrypt storage.
     * @param newPassword New password, to encrypt storage.
     * @emits `ProfileUpdated` with updated profile.
     * @emits `ActiveProfileChanged` with undefined profile, if active session has expired, or active profile.
     * @throws "Invalid profile id" if profile doesn't exist.
     * @throws "Invalid profile old password" if old password is invalid.
     * @throws "Profile storage corrupted" if something has broken.
     */
    public changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<Profile> {
        return this.request(new ChangeProfilePasswordRequest(id, oldPassword, newPassword));
    }

    /**
     * Deletes a profile and returns the deleted profile.
     * @param id Profile id.
     * @emits `ProfileDeleted` with deleted profile.
     * @emits `ActiveProfileChanged` with undefined profile.
     * @throws "Invalid profile id" if profile doesn't exist.
     */
    public deleteProfile(id: string): Promise<Profile> {
        return this.request(new DeleteProfileRequest(id));
    }

    /**
     * Imports profile from encrypted secret and signs in.
     * @param name Display name.
     * @param secret Encrypted secret (base64).
     * @param password Password to decrypt (and then encrypt) the secret.
     * @emits `ProfileAdded` with created profile.
     * @emits `ActiveProfileChanged` with created profile.
     * @throws "Invalid profile password" if password is invalid.
     */
    public importEncrypted(name: string, secret: string, password: string): Promise<Profile> {
        return this.request(new ImportEncryptedRequest(name, secret, password));
    }

    /**
     * Imports profile from plain secret and signs in.
     * @param name Display name.
     * @param secret Plain secret (base64).
     * @param password Password to encrypt the secret.
     * @emits `ProfileAdded` with created profile.
     * @emits `ActiveProfileChanged` with created profile.
     */
    public importPlain(name: string, secret: string, password: string): Promise<Profile> {
        return this.request(new ImportPlainRequest(name, secret, password));
    }

    /**
     * Imports profile from 24-words mnemonic phrase, representing plain secret, and signs in.
     * @param name Display name.
     * @param words 24-words mnemonic phrase.
     * @param password Password to encrypt the secret.
     * @emits `ProfileAdded` with created profile.
     * @emits `ActiveProfileChanged` with created profile.
     * @throws "Invalid mnemonic length" if mnemonic is empty of contains wrong number of words.
     * @throws "Invalid mnemonic word '{word}'" if mnemonic contains invalid word.
     * @throws "Invalid checksum" if mnemonic is invalid.
     */
    public importMnemonic(name: string, words: string[], password: string): Promise<Profile> {
        return this.request(new ImportMnemonicRequest(name, words, password));
    }

    /**
     * Returns encrypted profile secret (base64).
     * @param id Profile id.
     * @throws "Invalid profile id" if profile doesn't exist.
     */
    public exportEncrypted(id: string): Promise<string> {
        return this.request(new ExportEncryptedRequest(id));
    }

    /**
     * Returns plain profile secret (base64).
     * @param id Profile id.
     * @param password Password to decrypt the secret.
     * @throws "Invalid profile id" if profile doesn't exist.
     * @throws "Invalid profile password" if password is invalid.
     */
    public exportPlain(id: string, password: string): Promise<string> {
        return this.request(new ExportPlainRequest(id, password));
    }

    /**
     * Returns 24-words mnemonic phrase, representing plain profile secret.
     * @param id Profile id.
     * @param password Password to decrypt the secret.
     * @throws "Invalid profile id" if profile doesn't exist.
     * @throws "Invalid profile password" if password is invalid.
     */
    public exportMnemonic(id: string, password: string): Promise<string> {
        return this.request(new ExportMnemonicRequest(id, password));
    }
}