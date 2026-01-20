import { Fr } from "@aztec/foundation/curves/bn254";
import { ContractArtifact, FunctionSelector, StructType } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Gas, GasFees, GasSettings } from "@aztec/stdlib/gas";
import { HashedValues, TxContext, TxExecutionRequest } from "@aztec/stdlib/tx";
import { Action } from "@/wallet/services/execution/spec";
import { FpcInfo, FpcType } from "../spec";
import { IFpcHandler } from ".";
import { IPXE } from "../../pxe/proxy";
import { AztecNode } from "@aztec/stdlib/interfaces/client";
import { GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT } from "@aztec/constants";

export class DefaultFpcHandler implements IFpcHandler {
    public async getAsset(fpcAddress: string, pxe: IPXE, node: AztecNode): Promise<string | undefined> {
        const fnSelector = await FunctionSelector.fromSignature("get_accepted_asset()");
        const packedArgs = await HashedValues.fromArgs([]);
        const { l1ChainId, rollupVersion } = await node.getNodeInfo();
        const baseFees = await node.getCurrentBaseFees();
        const gasSettings = new GasSettings(
            new Gas(GAS_ESTIMATION_DA_GAS_LIMIT, GAS_ESTIMATION_L2_GAS_LIMIT),
            new Gas(0, 0),
            baseFees,
            new GasFees(0, 0),
        );
        const txContext = new TxContext(l1ChainId, rollupVersion, gasSettings);
        const txRequest = new TxExecutionRequest(
            AztecAddress.fromString(fpcAddress),
            fnSelector,
            packedArgs.hash,
            txContext,
            [packedArgs],
            [],
            [],
        );
        const simulatedTx = await pxe.simulateTx(
            txRequest, // txRequest
            true, // simulatePublic
            undefined, // skipTxValidation
            true, // skipFeeEnforcement
            undefined, // overrides
            undefined, // scopes
        );
        const returnValues = simulatedTx.getPrivateReturnValues();
        if (!returnValues.values || returnValues.values.length !== 1) {
            throw new Error("Failed to get FPC asset");
        }
        return returnValues.values[0].toString();
    }

    public acceptsPrivate(): boolean | undefined {
        return true;
    }

    public acceptsPublic(): boolean | undefined {
        return true;
    }

    public validateArtifact(artifact: ContractArtifact) {
        let fn = artifact.functions.find(x => x.name === "get_accepted_asset");
        if (!fn) {
            throw new Error("Function `get_accepted_asset` not found");
        }
        if (
            fn.parameters.length !== 0 ||
            fn.returnTypes.length !== 1 ||
            (fn.returnTypes[0] as StructType)?.path !== "aztec::protocol_types::address::aztec_address::AztecAddress"
        ) {
            throw new Error("Function `get_accepted_asset` has unsupported signature");
        }

        fn = artifact.functions.find(x => x.name === "fee_entrypoint_private");
        if (!fn) {
            throw new Error("Function `fee_entrypoint_private` not found");
        }
        if (
            fn.parameters.length !== 2 ||
            fn.parameters[0].type.kind !== "integer" ||
            fn.parameters[1].type.kind !== "field" ||
            fn.returnTypes.length !== 0
        ) {
            throw new Error("Function `fee_entrypoint_private` has unsupported signature");
        }

        fn = artifact.functions.find(x => x.name === "fee_entrypoint_public");
        if (!fn) {
            throw new Error("Function `fee_entrypoint_public` not found");
        }
        if (
            fn.parameters.length !== 2 ||
            fn.parameters[0].type.kind !== "integer" ||
            fn.parameters[1].type.kind !== "field" ||
            fn.returnTypes.length !== 0
        ) {
            throw new Error("Function `fee_entrypoint_public` has unsupported signature");
        }
    }

    public getFeePayload(fpc: FpcInfo, account: string, maxFee: Fr, inPublic?: boolean): Action[] {
        if (fpc.type !== FpcType.DefaultFpc) {
            throw new Error("Invalid FPC type");
        }
        if (!fpc.asset) {
            throw new Error("Invalid FPC asset");
        }
        const nonce = Fr.random();
        return inPublic
            ? [
                  {
                      kind: "add_public_authwit",
                      content: {
                          kind: "call",
                          caller: fpc.address,
                          contract: fpc.asset,
                          method: "transfer_in_public",
                          args: [account, fpc.address, maxFee.toString(), nonce.toString()],
                      },
                  },
                  {
                      kind: "call",
                      contract: fpc.address,
                      method: "fee_entrypoint_public",
                      args: [maxFee.toString(), nonce.toString()],
                  },
              ]
            : [
                  {
                      kind: "add_private_authwit",
                      content: {
                          kind: "call",
                          caller: fpc.address,
                          contract: fpc.asset,
                          method: "transfer_to_public",
                          args: [account, fpc.address, maxFee.toString(), nonce.toString()],
                      },
                  },
                  {
                      kind: "call",
                      contract: fpc.address,
                      method: "fee_entrypoint_private",
                      args: [maxFee.toString(), nonce.toString()],
                  },
              ];
    }

    public getTeardownGas(inPublic?: boolean): Gas {
        return inPublic ? new Gas(2_000, 150_000) : new Gas(25_000, 125_000);
    }

    public getTotalGas(inPublic?: boolean): Gas {
        return inPublic ? new Gas(10_000, 500_000) : new Gas(100_000, 500_000);
    }
}
