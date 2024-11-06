import { AztecAddress } from "@aztec/aztec.js";
import { IAccountInfo } from "../abstract";

export class AccountInfo implements IAccountInfo {
    constructor(
        public readonly id: number,
        public readonly address: AztecAddress,
        public readonly name: string,
    ) {}
}