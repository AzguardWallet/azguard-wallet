import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact } from "@aztec/stdlib/abi";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { Gas } from "@aztec/stdlib/gas";
import { CHAIN_IDS } from "@/components/ui/utils";
import { Action } from "@/wallet/services/execution/spec";
import { IPXE } from "@/wallet/services/pxe/proxy";
import { FpcInfo, FpcType } from "../spec";
import { CanonicalFpc, IFpcHandler } from ".";

export class DefaultSponsoredFpcHandler implements IFpcHandler {
    // Test-network convenience — no free fee payments on mainnet, so no canonical there.
    public async resolveCanonical(chainId: number, pxe: IPXE): Promise<CanonicalFpc | undefined> {
        if (chainId === CHAIN_IDS.ALPHANET) {
            return undefined;
        }
        const { address } = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
            constructorArgs: [],
            salt: new Fr(SPONSORED_FPC_SALT),
        });
        const contractInstance = await pxe.getContractInstance(address);
        if (!contractInstance) {
            throw new Error(`SponsoredFPC instance not found at ${address}`);
        }
        const contractArtifact = await pxe.getContractArtifact(contractInstance.originalContractClassId);
        if (!contractArtifact) {
            throw new Error(`SponsoredFPC artifact not found (class ${contractInstance.originalContractClassId})`);
        }
        return { type: FpcType.DefaultSponsoredFpc, contractInstance, contractArtifact };
    }

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
            },
        ];
    }

    public getTeardownGas(): Gas {
        return new Gas(0, 0);
    }

    public getTotalGas(): Gas {
        // NOTE: DA gas depends on the account type (wheter account emit event for FPC call or not)
        return new Gas(15_000, 35_000);
    }
}
