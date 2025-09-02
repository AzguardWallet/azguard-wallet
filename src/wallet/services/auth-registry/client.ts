import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { FeeSettings } from "@/wallet/services/execution/models";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { AUTH_REGISTRY_SERVICE_NAME, Authwit, Events, Methods } from "./spec";

export * from "./spec";

export class AuthRegistryServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onAuthwitAdded = new EventHandler<Authwit>();
    public readonly onAuthwitDeleted = new EventHandler<Authwit>();
    public readonly onRegistryEnabled = new EventHandler<string>();
    public readonly onRegistryDisabled = new EventHandler<string>();

    public constructor(name?: string) {
        super(AUTH_REGISTRY_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getAuthwits(account: string): Promise<Authwit[]> {
        return this.request("getAuthwits", account);
    }

    public revokeAuthwits(networkId: string, account: string, ids: number[], feeSettings: FeeSettings): Promise<void> {
        return this.request("revokeAuthwits", networkId, account, ids, feeSettings);
    }

    public getRegistryEnabled(account: string): Promise<boolean> {
        return this.request("getRegistryEnabled", account);
    }

    public setRegistryEnabled(
        networkId: string,
        account: string,
        enabled: boolean,
        feeSettings: FeeSettings,
    ): Promise<void> {
        return this.request("setRegistryEnabled", networkId, account, enabled, feeSettings);
    }

    public syncRegistry(networkId: string, account: string): Promise<void> {
        return this.request("syncRegistry", networkId, account);
    }
}
