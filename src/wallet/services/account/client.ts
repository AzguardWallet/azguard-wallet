import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Account, ACCOUNT_SERVICE_NAME, AccountType, Events, Methods } from "./spec";

export * from "./spec";

export class AccountServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onAccountAdded = new EventHandler<Account>();
    public readonly onAccountUpdated = new EventHandler<Account>();
    public readonly onAccountDeleted = new EventHandler<Account>();

    public constructor(name?: string) {
        super(ACCOUNT_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getAccounts(profileId: string, chainId: number, all?: boolean | undefined): Promise<Account[]> {
        return this.request("getAccounts", profileId, chainId, all);
    }

    public getAccount(profileId: string, chainId: number, address: string): Promise<Account | undefined> {
        return this.request("getAccount", profileId, chainId, address);
    }

    public createAccount(profileId: string, chainId: number, type: AccountType, name: string): Promise<Account> {
        return this.request("createAccount", profileId, chainId, type, name);
    }

    public changeAccountName(
        profileId: string,
        chainId: number,
        address: string,
        name: string,
    ): Promise<Account | undefined> {
        return this.request("changeAccountName", profileId, chainId, address, name);
    }

    public changeAccountVisibility(
        profileId: string,
        chainId: number,
        address: string,
        visible: boolean,
    ): Promise<Account | undefined> {
        return this.request("changeAccountVisibility", profileId, chainId, address, visible);
    }
}
