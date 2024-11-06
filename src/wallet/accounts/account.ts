import { AztecAddress } from "@aztec/aztec.js";
import { AccountType, IAccount, IAccountContract } from "../abstract";
import { AccountInfo } from "./account_info";

export class Account<T extends IAccountContract> extends AccountInfo implements IAccount {
    constructor(
        public readonly id: number,
        public readonly address: AztecAddress,
        public readonly name: string,
        public readonly type: AccountType,
        public readonly contract: T,
    ) {
        super(id, address, name);
    }
}