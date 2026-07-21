import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { IPXE } from "@/wallet/services/pxe/proxy";
import { CANONICAL_PRIVATE_FPC_ADDRESS, CANONICAL_PRIVATE_FPC_CLASS_ID } from "@/wallet/utils/private-fpc";
import { FpcInfo, FpcType } from "../spec";
import { CanonicalFpc, IFpcHandler } from ".";

/** Shape check: `pay_fee()` (0 args/returns) + `balance_of(address)` — specific enough to not match real tokens. */
export function isPrivateFpcArtifact(artifact: ContractArtifact): boolean {
    try {
        new PrivateFpcHandler().validateArtifact(artifact);
        return true;
    } catch {
        return false;
    }
}

export class PrivateFpcHandler implements IFpcHandler {
    // Available on every chain (the canonical address is chain-independent). Deployed
    // unpublished: fetch the artifact by the pinned class id (registry-backed fallback
    // in the PXE wrapper), derive the instance and verify it lands on the pinned address.
    public static async resolveCanonical(_chainId: number, pxe: IPXE): Promise<CanonicalFpc | undefined> {
        const address = AztecAddress.fromStringUnsafe(CANONICAL_PRIVATE_FPC_ADDRESS);
        const contractArtifact = await pxe.getContractArtifact(Fr.fromHexString(CANONICAL_PRIVATE_FPC_CLASS_ID));
        if (!contractArtifact) {
            return undefined;
        }
        const contractInstance = await getContractInstanceFromInstantiationParams(contractArtifact, {
            salt: Fr.zero(),
            deployer: AztecAddress.ZERO,
            skipArgsDecoding: true,
        });
        if (!contractInstance.address.equals(address)) {
            return undefined;
        }
        return { type: FpcType.PrivateFpc, contractInstance, contractArtifact };
    }

    public async getAsset(fpcAddress: string): Promise<string | undefined> {
        return fpcAddress;
    }

    public acceptsPrivate(): boolean | undefined {
        return true;
    }

    public acceptsPublic(): boolean | undefined {
        return false;
    }

    public validateArtifact(artifact: ContractArtifact): void {
        let fn = artifact.functions.find(x => x.name === "pay_fee");
        if (!fn) {
            throw new Error("Function `pay_fee` not found");
        }
        if (fn.parameters.length !== 0 || fn.returnTypes.length !== 0) {
            throw new Error("Function `pay_fee` has unsupported signature");
        }

        fn = artifact.functions.find(x => x.name === "balance_of");
        if (!fn) {
            throw new Error("Function `balance_of` not found");
        }
        if (fn.parameters.length !== 1 || fn.returnTypes.length !== 1) {
            throw new Error("Function `balance_of` has unsupported signature");
        }
    }

    public getFeePayload(fpc: FpcInfo): Action[] {
        return [
            {
                kind: "call",
                contract: fpc.address,
                method: "pay_fee",
                args: [],
            },
        ];
    }

    public getTeardownGas(): Gas {
        return new Gas(0, 0);
    }

    public getTotalGas(): Gas {
        return new Gas(2_000, 125_000);
    }
}
