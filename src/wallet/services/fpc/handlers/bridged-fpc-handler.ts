import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo } from "../spec";
import { IFpcHandler } from ".";

export class BridgedFpcHandler implements IFpcHandler {
    public async getAsset(): Promise<string | undefined> {
        return undefined;
    }

    public acceptsPrivate(): boolean | undefined {
        return true;
    }

    public acceptsPublic(): boolean | undefined {
        return undefined;
    }

    public validateArtifact(artifact: ContractArtifact) {
        const payFee = artifact.functions.find(x => x.name === "pay_fee");
        if (!payFee) {
            throw new Error("Function `pay_fee` not found");
        }
        if (payFee.parameters.length !== 0 || payFee.returnTypes.length !== 0) {
            throw new Error("Function `pay_fee` has unsupported signature");
        }

        const balanceOf = artifact.functions.find(x => x.name === "balance_of");
        if (!balanceOf) {
            throw new Error("Function `balance_of` not found");
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
        // Conservative estimate — BridgedFPC is lightweight (similar to SponsoredFPC)
        return new Gas(15_000, 35_000);
    }
}
