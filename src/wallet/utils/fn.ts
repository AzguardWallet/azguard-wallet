import { Fr } from "@aztec/foundation/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { PXE } from "@aztec/stdlib/interfaces/client";
import {
    HashedValues,
    NestedProcessReturnValues,
} from "@aztec/stdlib/tx";
import {
    AbiType,
    encodeArguments,
    FunctionAbi,
    FunctionSelector,
    FunctionType,
} from "@aztec/stdlib/abi";
import { AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";

export class FnImpl {
    constructor(
        public readonly name: string,
        public readonly impl: number,
    ) {}
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

    public async packArgs(args: any[]): Promise<HashedValues> {
        return await HashedValues.fromValues(encodeArguments(this.abi(), args));
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
    pxe: PXE,
    account: IAccountContract,
    contract: string,
    viewFn: ViewFn,
    args: any[],
): Promise<any> {
    if (viewFn.type === FunctionType.UNCONSTRAINED) {
        return await pxe.simulateUnconstrained(viewFn.name, args, AztecAddress.fromString(contract));
    }

    const packedArgs = await viewFn.packArgs(args);
    const call = new AzguardFunctionCall(
        AztecAddress.fromString(contract),
        await viewFn.getSelector(),
        packedArgs.hash,
        viewFn.type === FunctionType.PUBLIC,
        viewFn.isStatic
    );

    const txRequest = await account.buildTxExecutionRequest(pxe, [], [call], [packedArgs], Fr.zero());

    const tx = await pxe.simulateTx(
        txRequest, // txRequest
        true, // simulatePublic
        undefined, // msgSender
        undefined, // skipTxValidation
        true, // skipFeeEnforcement
        undefined, // profile
        [account.address], // scopes
    );

    return viewFn.type === FunctionType.PUBLIC
        ? viewFn.unpackResult(extractReturnValues(tx.getPublicReturnValues()))
        : viewFn.unpackResult(extractReturnValues([tx.getPrivateReturnValues()]));
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