import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo } from "../spec";
import { IFpcHandler } from ".";

export const privateFpcTokenName = "Private Fee Juice";
export const privateFpcTokenSymbol = "pFJ";

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
