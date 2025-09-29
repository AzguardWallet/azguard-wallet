import { PXE } from "@aztec/aztec.js";
import { Fr } from "@aztec/foundation/fields";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo, FpcType } from "../spec";
import { DefaultFpcHandler } from "./default-fpc-handler";
import { DefaultSponsoredFpcHandler } from "./default-sponsored-fpc-handler";

export interface IFpcHandler {
    getAsset(fpcAddress: string, pxe: PXE): Promise<string | undefined>;
    acceptsPublic(): boolean | undefined;
    acceptsPrivate(): boolean | undefined;
    validateArtifact(artifact: ContractArtifact): void;
    getFeePayload(fpc: FpcInfo, account: string, maxFee: Fr, inPublic?: boolean): Action[];
    getTeardownGas(inPublic?: boolean): Gas;
    getTotalGas(inPublic?: boolean): Gas;
}

export function getFpcHandler(type: FpcType) {
    switch (type) {
        case FpcType.DefaultFpc: {
            return new DefaultFpcHandler();
        }
        case FpcType.DefaultSponsoredFpc: {
            return new DefaultSponsoredFpcHandler();
        }
        default: {
            throw new Error("Invalid FPC type");
        }
    }
}
