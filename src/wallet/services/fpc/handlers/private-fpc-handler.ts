import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo, FpcType } from "../spec";
import { IFpcHandler, KnownFpc } from ".";

export const privateFpcTokenName = "Private Fee Juice";
export const privateFpcTokenSymbol = "pFJ";

// Canonical PrivateFPC v5.0.1 (salt 0, deployer 0, no constructor args) — address is chain-independent.
// Deployed privately by design: the instance is never published on-chain, so it can't be fetched from
// the node — we pin the class id and derive the instance from the artifact (registry-backed) instead.
export const CANONICAL_PRIVATE_FPC_ADDRESS = "0x1966fc6084e79aa92a5395d11149ee8cd87e8c43081e05294e7824f7b2927181";
const CANONICAL_PRIVATE_FPC_CLASS_ID = "0x032bc73c22b1d0ab26cce0c99d7ab71f0078962f9a92b060cc9c5cb87e4cfb08";

export function canonicalPrivateFpc(): KnownFpc {
    return {
        address: AztecAddress.fromStringUnsafe(CANONICAL_PRIVATE_FPC_ADDRESS),
        type: FpcType.PrivateFpc,
        classId: Fr.fromHexString(CANONICAL_PRIVATE_FPC_CLASS_ID),
    };
}

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
