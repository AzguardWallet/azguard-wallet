import { AztecAddress } from "@aztec/aztec.js";

export enum AccountType {
    SchnorrAccountV0
}

export interface IAccount {
    readonly id: number;
    readonly type: AccountType;
    readonly address: AztecAddress;
    name: string;
}

export interface IAccountManager {
    getAccounts(): Promise<Array<IAccount>>;
    createAccount(type: AccountType, name: string): Promise<IAccount>;
    changeAccountName(account: IAccount, newName: string | null): Promise<IAccount>;
}