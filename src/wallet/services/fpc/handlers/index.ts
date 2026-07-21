import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Gas } from "@aztec/stdlib/gas";
import { CHAIN_IDS } from "@/components/ui/utils";
import { Action } from "@/wallet/services/execution/spec";
import { IPXE } from "@/wallet/services/pxe/proxy";
import { FpcInfo, FpcType } from "../spec";
import { PrivateFpcHandler, canonicalPrivateFpc } from "./private-fpc-handler";
import { DefaultFpcHandler } from "./default-fpc-handler";
import { DefaultSponsoredFpcHandler, canonicalSponsoredFpc } from "./default-sponsored-fpc-handler";
import { AztecNode } from "@aztec/stdlib/interfaces/client";

/** A default FPC the wallet knows upfront. `classId` set = the canonical instance is
 * deployed unpublished, so it must be derived from the artifact instead of fetched. */
export type KnownFpc = { address: AztecAddress; type: FpcType; classId?: Fr };

/** Default FPCs to auto-add when present on the network. */
export async function getKnownFpcs(chainId: number): Promise<KnownFpc[]> {
    const known: KnownFpc[] = [];
    // Sponsored FPC is a test-network convenience — no free fee payments on mainnet,
    // so we do not auto-discover it there.
    if (chainId !== CHAIN_IDS.ALPHANET) {
        known.push(await canonicalSponsoredFpc());
    }
    known.push(canonicalPrivateFpc());
    return known;
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
