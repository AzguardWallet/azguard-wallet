export enum AccountType {
    SchnorrAccount
}

export interface IAccount {
    readonly id: number;
    readonly type: AccountType;
    readonly address: string;
    name: string;
}

export interface IAccountManager {
    getActiveAccount(): Promise<IAccount | null>;
    getAccounts(): Promise<Array<IAccount>>;
    createAccount(id: number, type: AccountType): Promise<IAccount>;
    setActiveAccount(account: IAccount): Promise<IAccount>;
    changeAccountName(account: IAccount, newName: string | null): Promise<IAccount>;
}