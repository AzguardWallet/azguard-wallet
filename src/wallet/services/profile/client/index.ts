import { EventMessage } from '@/wallet/base/messages';
import { ServiceClient } from '@/wallet/base/service-client';
import { ProfileServiceEvent, ProfileServiceEventMessage } from './events';
import {
    ChangeProfileNameRequest,
    ChangeProfilePasswordRequest,
    CreateProfileRequest,
    DeleteProfileRequest,
    ExportEncryptedRequest,
    ExportPlainRequest,
    GetActiveProfileRequest,
    GetProfilesRequest,
    ImportEncryptedRequest,
    ImportPlainRequest,
    LockRequest,
    UnlockProfileRequest
} from './methods';
import { Profile } from './models';

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
     * @param onProfileUnlocked Callback, called when a profile was unlocked.
     * @param onLocked Callback, called when the wallet was locked.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onProfileAdded?: (profile: Profile) => void,
        private readonly onProfileUpdated?: (profile: Profile) => void,
        private readonly onProfileDeleted?: (profile: Profile) => void,
        private readonly onProfileUnlocked?: (profile: Profile) => void,
        private readonly onLocked?: () => void,
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
            case ProfileServiceEvent.ProfileUnlocked:
                if (this.onProfileUnlocked) {
                    try {this.onProfileUnlocked((message as ProfileServiceEventMessage).profile!);}
                    catch {}
                }
                break;
            case ProfileServiceEvent.Locked:
                if (this.onLocked) {
                    try {this.onLocked();}
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
     * @emits `ProfileAdded` event.
     */
    public createProfile(name: string, password: string): Promise<Profile> {
        return this.request(new CreateProfileRequest(name, password));
    }

    /**
     * Tries to unlock a profile with the specified id and returns it, or undefined if failed.
     * @param id Profile id.
     * @param password Profile password.
     * @emits `ProfileUnlocked` event.
     */
    public unlockProfile(id: string, password: string): Promise<Profile | undefined> {
        return this.request(new UnlockProfileRequest(id, password));
    }

    /**
     * Locks the wallet, closing active sessions, if some.
     * @emits `Locked` event.
     */
    public lock(): Promise<void> {
        return this.request(new LockRequest());
    }

    /**
     * Changes profile name and returns the updated profile, or undefined if it didn't exist.
     * @param id Profile id.
     * @param name New display name.
     * @emits `ProfileUpdated` event.
     */
    public changeProfileName(id: string, name: string): Promise<Profile | undefined> {
        return this.request(new ChangeProfileNameRequest(id, name));
    }

    /**
     * Changes profile password and returns the updated profile, or undefined if it didn't exist.
     * @param id Profile id.
     * @param oldPassword Old password, to decrypt storage.
     * @param newPassword New password, to encrypt storage.
     * @emits `ProfileUpdated` event.
     */
    public changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<Profile | undefined> {
        return this.request(new ChangeProfilePasswordRequest(id, oldPassword, newPassword));
    }

    /**
     * Deletes a profile and returns the deleted profile, undefined if it didn't exist.
     * @param id Profile id.
     * @emits `ProfileDeleted` event. 
     */
    public deleteProfile(id: string): Promise<Profile | undefined> {
        return this.request(new DeleteProfileRequest(id));
    }

    /**
     * Imports and returns a new profile from encrypted secret.
     * @param name Display name.
     * @param secret Encrypted secret.
     * @param password Password to decrypt (and then encrypt) the secret.
     * @emits `ProfileAdded` event.
     */
    public importEncrypted(name: string, secret: string, password: string): Promise<Profile> {
        return this.request(new ImportEncryptedRequest(name, secret, password));
    }

    /**
     * Imports and returns a new profile from plain secret.
     * @param name Display name.
     * @param secret Plain secret.
     * @param password Password to encrypt the secret.
     * @emits `ProfileAdded` event.
     */
    public importPlain(name: string, secret: string, password: string): Promise<Profile> {
        return this.request(new ImportPlainRequest(name, secret, password));
    }

    /**
     * Returns encrypted profile secret.
     * @param id Profile id.
     */
    public exportEncrypted(id: string): Promise<string> {
        return this.request(new ExportEncryptedRequest(id));
    }

    /**
     * Returns plain profile secret.
     * @param id Profile id.
     * @param password Password to decrypt the secret.
     */
    public exportPlain(id: string, password: string): Promise<string> {
        return this.request(new ExportPlainRequest(id, password));
    }
}