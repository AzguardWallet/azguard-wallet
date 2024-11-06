import { AztecAddress } from '@aztec/aztec.js';
import { AccountType, IAccount, IAccountInfo, IAccountManager, IAccountContract, INetwork, IProfile } from "../abstract";
import { EntityStorage, StorageType } from "../storage";
import { array_max } from "../utils";
import { SchnorrAccountContractV0 } from '../contracts';
import { AccountInfo } from "./account_info";
import { Account } from './account';

type AccountDto = {
    type: AccountType,
    address: string,
    name: string,
}

export class AccountManager implements IAccountManager {
    private readonly profile: IProfile;
    private readonly network: INetwork;
    private readonly accounts: EntityStorage<AccountDto>;

    constructor(profile: IProfile, network: INetwork) {
        this.profile = profile;
        this.network = network;
        this.accounts = new EntityStorage(
            `azguard:core:accounts:${profile.id}:${network.chainId}`,
            StorageType.Local,
        );
    }
    
    public async getAccounts(): Promise<Array<IAccountInfo>> {
        const accounts = await this.accounts.getAll();
        return accounts.map(([k, v]) => new AccountInfo(+k, AztecAddress.fromString(v.address), v.name));
    }

    public async getAccount(id: number): Promise<IAccount | null> {
        const account = await this.accounts.get(`${id}`);
        if (account !== null) {
            const address = AztecAddress.fromString(account.address);
            const contract = this._getAccountContract(account.type, id);
            // extra check that can be removed later
            if (address.cmp(await contract.getAddress()) !== 0) {
                throw new Error('account address inconsistency found');
            }
            return new Account(id, address, account.name, account.type, contract);
        }
        return null;
    }
    
    public async createAccount(type: AccountType, name: string): Promise<IAccount> {
        const ids = await this.accounts.getKeys();
        const nextId = ids.length > 0 ? array_max(ids.map(x => +x)) + 1 : 0;
        const contract = this._getAccountContract(type, nextId);
        const account = new Account(nextId, await contract.getAddress(), name, type, contract);
        await this.accounts.set(`${account.id}`, {type: account.type, address: account.address.toString(), name: account.name});
        return account;
    }

    public async changeAccountName(account: IAccount, name: string): Promise<IAccount> {
        const dto = await this.accounts.get(`${account.id}`);
        if (dto !== null) {
            dto.name = name;
            await this.accounts.set(`${account.id}`, dto);
            return new Account(account.id, account.address, name, account.type, account.contract);
        }
        return account;
    }

    public deleteAccount(account: IAccount): Promise<void> {
        return this.accounts.delete(`${account.id}`);
    }

    private _getAccountContract(accountType: AccountType, accountId: number): IAccountContract {
        if (accountType !== AccountType.SchnorrV0) {
            throw new Error('unsupported account type');
        }
        return new SchnorrAccountContractV0(this.profile, this.network, accountId);
    }
}