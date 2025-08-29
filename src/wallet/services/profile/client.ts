import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { PROFILE_SERVICE_NAME, ProfileInfo, Events, Methods } from "./spec";

export * from "./spec";

export class ProfileServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onProfileAdded = new EventHandler<ProfileInfo>();
    public readonly onProfileUpdated = new EventHandler<ProfileInfo>();
    public readonly onProfileDeleted = new EventHandler<ProfileInfo>();
    public readonly onActiveProfileChanged = new EventHandler<ProfileInfo | undefined>();

    public constructor(name?: string) {
        super(PROFILE_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getActiveProfile(): Promise<ProfileInfo | undefined> {
        return this.request("getActiveProfile");
    }

    public getProfiles(): Promise<ProfileInfo[]> {
        return this.request("getProfiles");
    }

    public createProfile(name: string, password: string): Promise<ProfileInfo> {
        return this.request("createProfile", name, password);
    }

    public createPasskeyProfile(name: string): Promise<ProfileInfo> {
        return this.request("createPasskeyProfile", name);
    }

    public unlockProfile(id: string, password: string): Promise<ProfileInfo> {
        return this.request("unlockProfile", id, password);
    }

    public unlockPasskeyProfile(id: string): Promise<ProfileInfo> {
        return this.request("unlockPasskeyProfile", id);
    }

    public lockActiveProfile(): Promise<void> {
        return this.request("lockActiveProfile");
    }

    public refreshSession(): Promise<void> {
        return this.request("refreshSession");
    }

    public changeProfileName(id: string, newName: string): Promise<ProfileInfo> {
        return this.request("changeProfileName", id, newName);
    }

    public changeProfilePassword(id: string, oldPassword: string, newPassword: string): Promise<ProfileInfo> {
        return this.request("changeProfilePassword", id, oldPassword, newPassword);
    }

    public deleteProfile(id: string): Promise<ProfileInfo> {
        return this.request("deleteProfile", id);
    }

    public importEncrypted(name: string, secret: string, password: string): Promise<ProfileInfo> {
        return this.request("importEncrypted", name, secret, password);
    }

    public importPlain(name: string, secret: string, password: string): Promise<ProfileInfo> {
        return this.request("importPlain", name, secret, password);
    }

    public importMnemonic(name: string, mnemonic: string[], password: string): Promise<ProfileInfo> {
        return this.request("importMnemonic", name, mnemonic, password);
    }

    public importPasskey(name: string): Promise<ProfileInfo> {
        return this.request("importPasskey", name);
    }

    public exportEncrypted(id: string): Promise<string> {
        return this.request("exportEncrypted", id);
    }

    public exportPlain(id: string, password: string): Promise<string> {
        return this.request("exportPlain", id, password);
    }

    public exportMnemonic(id: string, password: string): Promise<string[]> {
        return this.request("exportMnemonic", id, password);
    }
}
