import { Fr } from "@aztec/aztec.js";
import { poseidon2Hash } from "@aztec/foundation/crypto";
import { RequestMessage, ResponseMessage, EventMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { ProfileService } from "@/wallet/services/profile";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max } from "@/wallet/utils";
import {
    Account,
    ACCOUNT_SERVICE_NAME,
    AccountServiceEvent,
    AccountServiceEventMessage,
    AccountServiceMethod,
    AccountType,
    ChangeAccountNameRequest,
    ChangeAccountNameResponse,
    ChangeAccountVisibilityRequest,
    ChangeAccountVisibilityResponse,
    CreateAccountRequest,
    CreateAccountResponse,
    GetAccountRequest,
    GetAccountResponse,
    GetAccountsRequest,
    GetAccountsResponse
} from "./client";
import { AzguardV0, IAccountContract } from "./contracts";

type AccountDto = {
    index: number,
    type: AccountType,
    name: string,
    visible: boolean,
}

export class AccountService extends Service {
    public readonly onAccountAdded: ((account: Account) => void)[] = [];

    constructor(
        private readonly profiles: ProfileService,
        emit: (event: EventMessage) => void,
    ) {
        super(ACCOUNT_SERVICE_NAME, emit);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case AccountServiceMethod.GetAccounts: {
                const _request = request as GetAccountsRequest;
                try {
                    const accounts = await this.getAccounts(_request.profileId, _request.chainId, _request.all);
                    return new GetAccountsResponse(_request, accounts);
                }
                catch (error: any) {
                    return new GetAccountsResponse(_request, undefined, error.message);
                }
            }
            case AccountServiceMethod.GetAccount: {
                const _request = request as GetAccountRequest;
                try {
                    const account = await this.getAccount(_request.profileId, _request.chainId, _request.address);
                    return new GetAccountResponse(_request, account);
                }
                catch (error: any) {
                    return new GetAccountResponse(_request, undefined, error.message);
                }
            }
            case AccountServiceMethod.CreateAccount: {
                const _request = request as CreateAccountRequest;
                try {
                    const account = await this.createAccount(_request.profileId, _request.chainId, _request.accountType, _request.name);
                    this.emit(new AccountServiceEventMessage(AccountServiceEvent.AccountAdded, account));
                    for (const emit of this.onAccountAdded) {
                        try {emit(account)} catch {}
                    }
                    return new CreateAccountResponse(_request, account);
                }
                catch (error: any) {
                    return new CreateAccountResponse(_request, undefined, error.message);
                }
            }
            case AccountServiceMethod.ChangeAccountName: {
                const _request = request as ChangeAccountNameRequest;
                try {
                    const account = await this.changeAccountName(_request.profileId, _request.chainId, _request.address, _request.name);
                    if (account) {
                        this.emit(new AccountServiceEventMessage(AccountServiceEvent.AccountUpdated, account));
                    }
                    return new ChangeAccountNameResponse(_request, account);
                }
                catch (error: any) {
                    return new ChangeAccountNameResponse(_request, undefined, error.message);
                }
            }
            case AccountServiceMethod.ChangeAccountVisibility: {
                const _request = request as ChangeAccountVisibilityRequest;
                try {
                    const account = await this.changeAccountVisibility(_request.profileId, _request.chainId, _request.address, _request.visible);
                    if (account) {
                        this.emit(new AccountServiceEventMessage(AccountServiceEvent.AccountUpdated, account));
                    }
                    return new ChangeAccountVisibilityResponse(_request, account);
                }
                catch (error: any) {
                    return new ChangeAccountVisibilityResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async getAccounts(profileId: string, chainId: number, all?: boolean): Promise<Array<Account>> {
        const storage = this._getStorage(profileId, chainId);
        const accounts = await storage.getAll();
        return accounts
            .filter(([_, v]) => !!all || v.visible)
            .map(([k, v]) => new Account(profileId, chainId, k, v.index, v.type, v.name, v.visible));
    }

    public async getAccount(profileId: string, chainId: number, address: string): Promise<Account | undefined> {
        const storage = this._getStorage(profileId, chainId);
        const account = await storage.get(address);
        if (account !== undefined) {
            return new Account(profileId, chainId, address, account.index, account.type, account.name, account.visible);
        }
        return undefined;
    }

    public async createAccount(profileId: string, chainId: number, type: AccountType, name: string): Promise<Account> {
        const storage = this._getStorage(profileId, chainId);
        const accounts = await storage.getValues();
        const index = accounts.length > 0
            ? array_max(accounts.filter(x => x.type === type).map(x => +x.index)) + 1
            : 0;

        const secret = await this._deriveAccountSecret(profileId, chainId, type, index);
        let address;
        switch (type) {
            case AccountType.Azguard_v0:
                address = new AzguardV0(secret).address.toString();
                break;
            default:
                throw new Error('unsupported account type');
        }

        await storage.set(address, { index, type, name, visible: true });
        return new Account(profileId, chainId, address, index, type, name, true);
    }

    public async changeAccountName(profileId: string, chainId: number, address: string, name: string): Promise<Account | undefined> {
        const storage = this._getStorage(profileId, chainId);
        const account = await storage.get(address);
        if (account !== undefined) {
            account.name = name;
            await storage.set(address, account);
            return new Account(profileId, chainId, address, account.index, account.type, account.name, account.visible);
        }
        return undefined;
    }

    public async changeAccountVisibility(profileId: string, chainId: number, address: string, visible: boolean): Promise<Account | undefined> {
        const storage = this._getStorage(profileId, chainId);
        const account = await storage.get(address);
        if (account !== undefined) {
            account.visible = visible;
            await storage.set(address, account);
            return new Account(profileId, chainId, address, account.index, account.type, account.name, account.visible);
        }
        return undefined;
    }

    public async signPayload(profileId: string, chainId: number, address: string, payload: string): Promise<string> {
        const storage = this._getStorage(profileId, chainId);
        const account = await storage.get(address);
        if (!account) {
            throw new Error("account doesn't exist");
        }
        switch (account.type) {
            case AccountType.Azguard_v0: {
                const secret = await this._deriveAccountSecret(profileId, chainId, account.type, account.index);
                return new AzguardV0(secret).signPayload(Buffer.from(payload, 'hex'));
            }
            default:
                throw new Error('unsupported account type');
        }
    }

    public async getAccountContract(profileId: string, chainId: number, address: string): Promise<IAccountContract> {
        const storage = this._getStorage(profileId, chainId);
        const account = await storage.get(address);
        if (!account) {
            throw new Error("unknown account address");
        }
        
        let accountContract: IAccountContract;
        switch (account.type) {
            case AccountType.Azguard_v0: {
                const secret = await this._deriveAccountSecret(profileId, chainId, account.type, account.index);
                accountContract = new AzguardV0(secret);
                break;
            }
            default:
                throw new Error("unknown account type");
        }

        if (accountContract.address.toString() !== address) {
            throw new Error("account address inconsistency");
        }

        return accountContract;
    }

    private async _deriveAccountSecret(profileId: string, chainId: number, type: number, index: number): Promise<Fr> {
        const master = await this.profiles.getProfileSecret(profileId);
        if (!master) {
            throw new Error('unauthorized');
        }
        return poseidon2Hash([master, chainId, type, index]);
    }

    private _getStorage(profileId: string, chainId: number): EntityStorage<AccountDto> {
        return new EntityStorage(
            `azguard:core:accounts:${profileId}:${chainId}`,
            StorageType.Local,
        );
    }
}