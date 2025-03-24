import { Fr } from "@aztec/foundation/fields";
import { ContractArtifact, FunctionSelector, StructType } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Gas, GasFees, GasSettings } from "@aztec/stdlib/gas";
import { PXE } from "@aztec/stdlib/interfaces/client";
import { HashedValues, TxContext, TxExecutionRequest } from "@aztec/stdlib/tx";
import {
    AddPrivateAuthwitAction,
    AddPublicAuthwitAction,
    CallAction,
    CallAuthwitContent,
    IAction,
} from "@/wallet/services/execution/client";
import { FpcInfo, FpcType } from "../client";
import { IFpcHandler } from ".";

export class DefaultFpcHandler implements IFpcHandler {
    public async getAsset(fpcAddress: string, pxe: PXE): Promise<string | undefined> {
        const fnSelector = await FunctionSelector.fromSignature("get_accepted_asset()");
        const packedArgs = await HashedValues.fromValues([]);
        const { l1ChainId, protocolVersion } = await pxe.getNodeInfo();
        const gasSettings = new GasSettings(
            new Gas(4_294_967_295, 4_294_967_295),
            new Gas(0, 0),
            new GasFees(0, 0),
            new GasFees(0, 0),
        );
        const txContext = new TxContext(l1ChainId, protocolVersion, gasSettings);
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
            undefined, // msgSender
            undefined, // skipTxValidation
            true, // skipFeeEnforcement
            undefined, // profile
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
            (fn.returnTypes[0] as StructType)?.path !==
                "authwit::aztec::protocol_types::address::aztec_address::AztecAddress"
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

    public getFeePayload(fpc: FpcInfo, account: string, maxFee: Fr, inPublic?: boolean): IAction[] {
        if (fpc.type !== FpcType.DefaultFpc) {
            throw new Error("Invalid FPC type");
        }
        if (!fpc.asset) {
            throw new Error("Invalid FPC asset");
        }
        const nonce = Fr.random();
        return inPublic
            ? [
                new AddPublicAuthwitAction(
                    new CallAuthwitContent(fpc.address, fpc.asset, "transfer_in_public", [
                        account,
                        fpc.address,
                        maxFee.toString(),
                        nonce.toString(),
                    ]),
                ),
                new CallAction(fpc.address, "fee_entrypoint_public", [maxFee.toString(), nonce.toString()]),
            ]
            : [
                new AddPrivateAuthwitAction(
                    new CallAuthwitContent(fpc.address, fpc.asset, "transfer_to_public", [
                        account,
                        fpc.address,
                        maxFee.toString(),
                        nonce.toString(),
                    ]),
                ),
                new CallAction(fpc.address, "fee_entrypoint_private", [maxFee.toString(), nonce.toString()]),
            ];
    }

    public getTeardownGas(inPublic?: boolean): Gas {
        return inPublic ? new Gas(2_000, 150_000) : new Gas(25_000, 125_000);
    }

    public getTotalGas(inPublic?: boolean): Gas {
        return inPublic ? new Gas(10_000, 500_000) : new Gas(100_000, 500_000);
    }
}
