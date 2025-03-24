import { ContractArtifact } from "@aztec/stdlib/abi";
import { Gas } from "@aztec/stdlib/gas";
import { CallAction, IAction } from "@/wallet/services/execution/client";
import { FpcInfo } from "../client";
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

    public getFeePayload(fpc: FpcInfo): IAction[] {
        return [new CallAction(fpc.address, "sponsor_unconditionally", [])];
    }

    public getTeardownGas(): Gas {
        return new Gas(0, 0);
    }

    public getTotalGas(): Gas {
        return new Gas(5_000, 25_000);
    }
}
