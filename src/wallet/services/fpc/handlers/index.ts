import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import type { ContractInstancePreimageWithAddress } from "@aztec/stdlib/contract";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { IPXE } from "@/wallet/services/pxe/proxy";
import { FpcInfo, FpcType } from "../spec";
import { PrivateFpcHandler } from "./private-fpc-handler";
import { DefaultFpcHandler } from "./default-fpc-handler";
import { DefaultSponsoredFpcHandler } from "./default-sponsored-fpc-handler";
import { AztecNode } from "@aztec/stdlib/interfaces/client";

/** A canonical default FPC resolved on a concrete network, ready to register. */
export type CanonicalFpc = {
    type: FpcType;
    contractInstance: ContractInstancePreimageWithAddress;
    contractArtifact: ContractArtifact;
};

/** Default FPCs to auto-add. Each handler's static `resolveCanonical(chainId, pxe)`
 * decides itself whether its FPC exists on the given chain and how to find it. */
export async function resolveCanonicalFpcs(chainId: number, pxe: IPXE): Promise<CanonicalFpc[]> {
    const candidates = await Promise.all([
        DefaultSponsoredFpcHandler.resolveCanonical(chainId, pxe),
        PrivateFpcHandler.resolveCanonical(chainId, pxe),
    ]);
    return candidates.filter(candidate => candidate !== undefined);
}

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
        case FpcType.PrivateFpc: {
            return new PrivateFpcHandler();
        }
        default: {
            throw new Error("Invalid FPC type");
        }
    }
}
