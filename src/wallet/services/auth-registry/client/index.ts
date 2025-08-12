import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { FeeSettings } from "@/wallet/services/execution/client";
import { AuthRegistryServiceEvent, type AuthRegistryServiceEventMessage } from "./events";
import {
    GetAuthwitsRequest,
    RevokeAuthwitsRequest,
    GetRegistryEnabledRequest,
    SetRegistryEnabledRequest,
    SyncRegistryRequest,
} from "./methods";
import type { Authwit } from "./models";

export * from "./events";
export * from "./methods";
export * from "./models";

export const AUTH_REGISTRY_SERVICE_NAME = "auth-registry";

/**
 * Client for interaction with the AuthRegistryService via messaging API
 */
export class AuthRegistryServiceClient extends ServiceClient {
    /**
     * Creates AuthRegistryServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onAuthwitAdded Callback, called when a new authwit was added.
     * @param onAuthwitDeleted Callback, called when an existing authwit was deleted.
     * @param onRegistryEnabled Callback, called when an auth registry was enabled.
     * @param onRegistryDisabled Callback, called when an auth registry was disabled.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onAuthwitAdded?: (authwit: Authwit) => void,
        private readonly onAuthwitDeleted?: (authwit: Authwit) => void,
        private readonly onRegistryEnabled?: (account: string) => void,
        private readonly onRegistryDisabled?: (account: string) => void,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case AuthRegistryServiceEvent.AuthwitAdded:
                if (this.onAuthwitAdded) {
                    try {
                        this.onAuthwitAdded((message as AuthRegistryServiceEventMessage).authwit!);
                    } catch {}
                }
                break;
            case AuthRegistryServiceEvent.AuthwitDeleted:
                if (this.onAuthwitDeleted) {
                    try {
                        this.onAuthwitDeleted((message as AuthRegistryServiceEventMessage).authwit!);
                    } catch {}
                }
                break;
            case AuthRegistryServiceEvent.RegistryEnabled:
                if (this.onRegistryEnabled) {
                    try {
                        this.onRegistryEnabled((message as AuthRegistryServiceEventMessage).account!);
                    } catch {}
                }
                break;
            case AuthRegistryServiceEvent.RegistryDisabled:
                if (this.onRegistryDisabled) {
                    try {
                        this.onRegistryDisabled((message as AuthRegistryServiceEventMessage).account!);
                    } catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of tracked public authwits for the account.
     * @param account Account address.
     */
    public getAuthwits(account: string): Promise<Authwit[]> {
        return this.request(new GetAuthwitsRequest(account));
    }

    /**
     * Revokes up to MAX_REVOKES_PER_TX authwits (sends a transaction).
     * @param networkId Network id.
     * @param account Account address.
     * @param ids Ids of the authwits to revoke.
     * @param feeSettings Fee settings to be used for sending the transaction.
     */
    public revokeAuthwits(networkId: string, account: string, ids: number[], feeSettings: FeeSettings): Promise<void> {
        return this.request(new RevokeAuthwitsRequest(networkId, account, ids, feeSettings));
    }

    /**
     * Returns whether or not the auth registry is enabled for the account.
     * @param account Account address.
     */
    public getRegistryEnabled(account: string): Promise<boolean> {
        return this.request(new GetRegistryEnabledRequest(account));
    }

    /**
     * Enables or disables auth registry for the account.
     * @param networkId Network id.
     * @param account Account address.
     * @param enabled Whether to enable or disable the auth registry.
     * @param feeSettings Fee settings to be used for sending the transaction.
     */
    public setRegistryEnabled(
        networkId: string,
        account: string,
        enabled: boolean,
        feeSettings: FeeSettings,
    ): Promise<void> {
        return this.request(new SetRegistryEnabledRequest(networkId, account, enabled, feeSettings));
    }

    /**
     * Triggers synchronization of the auth registry for the account.
     * @param networkId Network id.
     * @param account Account address.
     */
    public syncRegistry(networkId: string, account: string): Promise<void> {
        return this.request(new SyncRegistryRequest(networkId, account));
    }
}
