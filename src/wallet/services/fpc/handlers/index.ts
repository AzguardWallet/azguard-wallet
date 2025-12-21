import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { IPXE } from "@/wallet/services/pxe/proxy";
import { FpcInfo, FpcType } from "../spec";
import { DefaultFpcHandler } from "./default-fpc-handler";
import { DefaultSponsoredFpcHandler } from "./default-sponsored-fpc-handler";
import { AztecNode } from "@aztec/stdlib/interfaces/client";

export interface IFpcHandler {
    getAsset(fpcAddress: string, pxe: IPXE, node: AztecNode): Promise<string | undefined>;
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
