import { AztecAddress } from "@aztec/aztec.js";

export interface IAccountContract {
    getAddress(): Promise<AztecAddress>;
}