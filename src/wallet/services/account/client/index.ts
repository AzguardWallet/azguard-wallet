import { EventMessage } from '@/wallet/base/messages';
import { ServiceClient } from '@/wallet/base/service-client';
import { Profile } from '@/wallet/services/profile/client';
import { Network } from '@/wallet/services/network/client';
import { Account, AccountType } from './models';
import { AccountServiceEvent, AccountServiceEventMessage } from './events';
import {
    ChangeAccountNameRequest,
    ChangeAccountVisibilityRequest,
    CreateAccountRequest,
    GetAccountRequest,
    GetAccountsRequest
} from './methods';

export * from './events';
export * from './methods';
export * from './models';

export const ACCOUNT_SERVICE_NAME = "account";

/**
 * Client for interaction with the AccountService via messaging API
 */
export class AccountServiceClient extends ServiceClient {
    /**
     * Creates AccountServiceClient instace.
     * @param profile Profile, determining accounts scope (each profile + network has its own set of accounts).
     * @param network Network, determining accounts scope (each profile + network has its own set of accounts).
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onAccountAdded Callback, called when a new account was created.
     * @param onAccountUpdated Callback, called when an existing account was updated.
     * @param onAccountDeleted Callback, called when an existing account was deleted.
     */
    constructor(
        private readonly profile: Profile,
        private readonly network: Network,
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onAccountAdded?: (account: Account) => void,
        private readonly onAccountUpdated?: (account: Account) => void,
        private readonly onAccountDeleted?: (account: Account) => void,
    ) {
        super(ACCOUNT_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        const account = (message as AccountServiceEventMessage)?.account;
        if (account?.profileId === this.profile.id && account?.chainId === this.network.chainId) {
            switch (message.event) {
                case AccountServiceEvent.AccountAdded:
                    if (this.onAccountAdded) {
                        try {this.onAccountAdded(account);}
                        catch {}
                    }
                    break;
                case AccountServiceEvent.AccountUpdated:
                    if (this.onAccountUpdated) {
                        try {this.onAccountUpdated(account);}
                        catch {}
                    }
                    break;
                case AccountServiceEvent.AccountDeleted:
                    if (this.onAccountDeleted) {
                        try {this.onAccountDeleted(account);}
                        catch {}
                    }
                    break;
                default:
                    console.error(`Unexpected event type ${message.event}.`);
                    break;
            }
        }
    }
    
    /**
     * Returns a list of accounts.
     * @param all Whether to return all (including hidden) or only active accounts.
     */
    public getAccounts(all?: boolean): Promise<Array<Account>> {
        return this.request(new GetAccountsRequest(this.profile.id, this.network.chainId, all));
    }

    /**
     * Returns an account with the specified address, or undefined if it doesn't exist.
     * @param address Account contract address.
     */
    public getAccount(address: string): Promise<Account | undefined> {
        return this.request(new GetAccountRequest(this.profile.id, this.network.chainId, address));
    }

    /**
     * Creates and returns a new account.
     * @param type Account contract type.
     * @param name Display name.
     * @emits `AccountAdded` event.
     */
    public createAccount(type: AccountType, name: string): Promise<Account> {
        return this.request(new CreateAccountRequest(this.profile.id, this.network.chainId, type, name));
    }

    /**
     * Changes an account name and returns the account, or undefined if it doesn't exist.
     * @param address Account contract address.
     * @param name New display name.
     * @emits `AccountUpdated` event.
     */
    public changeAccountName(address: string, name: string): Promise<void> {
        return this.request(new ChangeAccountNameRequest(this.profile.id, this.network.chainId, address, name));
    }

    /**
     * Changes an account visibility and returns the account, or undefined if it doesn't exist.
     * @param address Account contract address.
     * @param visible New visibility flag.
     * @emits `AccountUpdated` event.
     */
    public changeAccountVisibility(address: string, visible: boolean): Promise<Profile | undefined> {
        return this.request(new ChangeAccountVisibilityRequest(this.profile.id, this.network.chainId, address, visible));
    }
}