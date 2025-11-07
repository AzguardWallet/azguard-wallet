import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo } from "../spec";
import { IFpcHandler } from ".";

export class DefaultSponsoredFpcHandler implements IFpcHandler {
    public async getAsset(): Promise<string | undefined> {
        return undefined;
    }

    public acceptsPrivate(): boolean | undefined {
        return undefined;
    }

    public acceptsPublic(): boolean | undefined {
        return undefined;
    }

    public validateArtifact(artifact: ContractArtifact) {
        let fn = artifact.functions.find(x => x.name === "sponsor_unconditionally");
        if (!fn) {
            throw new Error("Function `sponsor_unconditionally` not found");
        }
        if (fn.parameters.length !== 0 || fn.returnTypes.length !== 0) {
            throw new Error("Function `sponsor_unconditionally` has unsupported signature");
        }
    }

    public getFeePayload(fpc: FpcInfo): Action[] {
        return [
            {
                kind: "call",
                contract: fpc.address,
                method: "sponsor_unconditionally",
                args: [],
                hideSender: false,
            },
        ];
    }

    public getTeardownGas(): Gas {
        return new Gas(0, 0);
    }

    public getTotalGas(): Gas {
        return new Gas(5_000, 25_000);
    }
}
