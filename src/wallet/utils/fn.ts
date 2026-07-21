import { Fr } from "@aztec/foundation/curves/bn254";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { HashedValues, NestedProcessReturnValues, PrivateCallExecutionResult } from "@aztec/stdlib/tx";
import { AbiType, encodeArguments, FunctionAbi, FunctionCall, FunctionSelector, FunctionType } from "@aztec/stdlib/abi";
import { AzguardFeePaymentMethod, AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";
import { AztecNode } from "@aztec/stdlib/interfaces/client";
import { IPXE } from "@/wallet/services/pxe/proxy";

export class FnImpl {
    constructor(public readonly name: string, public readonly impl: number) {}
}

export abstract class Fn extends FnImpl {
    public readonly isStatic: boolean;
    public readonly type: FunctionType;

    constructor(name: string, impl: number) {
        super(name, impl);

        const abi = this.abi();
        this.isStatic = abi.isStatic;
        this.type = abi.functionType;
    }

    protected abstract abi(): FunctionAbi;

    public abstract buildArgs(...args: any[]): any[];

    public async getSelector(): Promise<FunctionSelector> {
        const abi = this.abi();
        return await FunctionSelector.fromNameAndParameters(abi.name, abi.parameters);
    }

    public encodeArgs(args: any[]): Fr[] {
        return encodeArguments(this.abi(), args);
    }

    public getReturnTypes(): AbiType[] {
        return this.abi().returnTypes;
    }

    public getImpl(): FnImpl {
        return new FnImpl(this.name, this.impl);
    }
}

export abstract class ViewFn extends Fn {
    public abstract unpackResult(values: Fr[]): any;
}

export async function simulate(
    node: AztecNode,
    pxe: IPXE,
    account: IAccountContract,
    contract: string,
    viewFn: ViewFn,
    args: any[],
): Promise<any> {
    const contractAddress = AztecAddress.fromStringUnsafe(contract);
    const fnSelector = await viewFn.getSelector();
    const encodedArgs = viewFn.encodeArgs(args);

    if (viewFn.type === FunctionType.UTILITY) {
        const call = new FunctionCall(
            viewFn.name,
            contractAddress,
            fnSelector,
            viewFn.type,
            false,
            viewFn.isStatic,
            encodedArgs,
            viewFn.getReturnTypes(),
        );
        const { result } = await pxe.executeUtility(call, { scopes: [account.address] });
        return viewFn.unpackResult(result);
    }

    const packedArgs =
        viewFn.type === FunctionType.PUBLIC
            ? await HashedValues.fromCalldata([fnSelector.toField(), ...encodedArgs])
            : await HashedValues.fromArgs(encodedArgs);

    const call = new AzguardFunctionCall(
        contractAddress,
        fnSelector,
        packedArgs.hash,
        viewFn.type === FunctionType.PUBLIC,
        viewFn.isStatic,
        false,
    );

    const txRequest = await account.buildTxExecutionRequest(
        node,
        pxe,
        [call],
        Fr.random(),
        AzguardFeePaymentMethod.FeeJuice,
        [packedArgs],
    );

    const tx = await pxe.simulateTx(txRequest, {
        simulatePublic: true,
        skipFeeEnforcement: true,
        scopes: [account.address],
    });

    if (viewFn.type === FunctionType.PUBLIC) {
        return viewFn.unpackResult(extractReturnValues(tx.getPublicReturnValues()));
    }

    // Target our specific call's frame by contract+selector. For a not-yet-deployed account
    // simulateTx bundles the deployment (constructor + handshake) whose private return values
    // would otherwise precede ours in a flat list, so blindly reading result[0] grabs a
    // deployment field (crashes on decimals, silently garbles name/symbol).
    const returnValues = findReturnValues(tx.privateExecutionResult.entrypoint, contractAddress, fnSelector);
    if (!returnValues) {
        throw new Error(`Simulation return values not found for ${viewFn.name}`);
    }
    return viewFn.unpackResult(returnValues);
}

function findReturnValues(
    node: PrivateCallExecutionResult,
    contract: AztecAddress,
    selector: FunctionSelector,
): Fr[] | undefined {
    const cc = node.publicInputs.callContext;
    if (cc.contractAddress.toString() === contract.toString() && cc.functionSelector.toString() === selector.toString()) {
        return node.returnValues;
    }
    for (const child of node.nestedExecutionResults) {
        const found = findReturnValues(child, contract, selector);
        if (found) {
            return found;
        }
    }
    return undefined;
}

function extractReturnValues(values: NestedProcessReturnValues[]): Fr[] {
    const res = [];
    for (const v of values) {
        for (const value of v.values ?? []) {
            res.push(value);
        }
        res.push(...extractReturnValues(v.nested));
    }
    return res;
}
