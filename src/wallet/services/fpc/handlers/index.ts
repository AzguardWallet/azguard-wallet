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

/** Every type whose handler may have a canonical default FPC to seed. Driving seeding
 * off this list + `getFpcHandler` keeps seeding and dispatch on one registry, and
 * `IFpcHandler` forces every new handler to declare whether it has a canonical FPC. */
export const CANONICAL_FPC_TYPES = [FpcType.DefaultFpc, FpcType.DefaultSponsoredFpc, FpcType.PrivateFpc];

export interface IFpcHandler {
    /** Fetch the instance + artifact of this handler's canonical default FPC (hits the
     * PXE). Returns undefined when there is no canonical by design (user-added types
     * always, chain-specific opt-outs) — seeding marks the type as done. Throws when a
     * canonical is expected but cannot be resolved — seeding leaves the type unmarked
     * and retries on the next account. */
    resolveCanonical(chainId: number, pxe: IPXE): Promise<CanonicalFpc | undefined>;
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
