import { AztecAddress } from "@aztec/aztec.js";
import { IAccountContract } from ".";

export enum AccountType {
    SchnorrV0
}

export interface IAccountInfo {
    readonly id: number;
    readonly address: AztecAddress;
    readonly name: string;
}

export interface IAccount extends IAccountInfo {
    readonly type: AccountType;
    readonly contract: IAccountContract;
}

export interface IAccountManager {
    getAccounts(): Promise<Array<IAccountInfo>>;
    getAccount(id: number): Promise<IAccount | null>;
    createAccount(type: AccountType, name: string): Promise<IAccount>;
    changeAccountName(account: IAccount, name: string): Promise<IAccount>;
    deleteAccount(account: IAccount): Promise<void>;
}