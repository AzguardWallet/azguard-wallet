import { AztecAddress, Fr, FunctionSelector, PackedValues,PXE } from "@aztec/aztec.js";
import { NestedProcessReturnValues, TxReceipt, TxStatus } from "@aztec/circuit-types";
import { encodeArguments, FunctionAbi, FunctionType } from "@aztec/foundation/abi";
import { AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";
import { sleep } from "./sleep";

export class FnImpl {
    constructor(
        public readonly name: string,
        public readonly impl: number,
    ) {}
}

export abstract class Fn extends FnImpl {
    public readonly isStatic: boolean;
    public readonly selector: FunctionSelector;
    public readonly type: FunctionType;

    constructor(name: string, impl: number) {
        super(name, impl);

        const abi = this.abi();
        this.isStatic = abi.isStatic;
        this.selector = FunctionSelector.fromNameAndParameters(abi.name, abi.parameters);
        this.type = abi.functionType;
    }

    protected abstract abi(): FunctionAbi;
    
    public abstract buildArgs(...args: any[]): any[];

    public packArgs(args: any[]): PackedValues {
        return PackedValues.fromValues(encodeArguments(this.abi(), args));
    }

    public getImpl(): FnImpl {
        return new FnImpl(this.name, this.impl);
    }
}

export abstract class ViewFn extends Fn {
    public abstract unpackResult(values: Fr[]): any;
}

export async function execute(
    pxe: PXE,
    account: IAccountContract,
    contract: string,
    fn: Fn,
    args: any[],
): Promise<string> {
    const packedArgs = fn.packArgs(args);
    const call = new AzguardFunctionCall(
        AztecAddress.fromString(contract),
        fn.selector,
        packedArgs.hash,
        fn.type === FunctionType.PUBLIC,
        fn.isStatic
    );

    const txRequest = await account.buildTxExecutionRequest(pxe, [call], [packedArgs], Fr.random());

    const tx = await pxe.simulateTx(txRequest, true);
    const provenTx = await pxe.proveTx(txRequest, tx.privateExecutionResult);
    const txHash = await pxe.sendTx(provenTx.toTx());

    let tries = 100;
    let txReceipt: TxReceipt;
    do { await sleep(100); txReceipt = await pxe.getTxReceipt(txHash); }
    while (txReceipt.status === TxStatus.PENDING && --tries >= 0);

    return txReceipt.txHash.toString();
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

    const packedArgs = viewFn.packArgs(args);
    const call = new AzguardFunctionCall(
        AztecAddress.fromString(contract),
        viewFn.selector,
        packedArgs.hash,
        viewFn.type === FunctionType.PUBLIC,
        viewFn.isStatic
    );

    const txRequest = await account.buildTxSimulationRequest(pxe, call, packedArgs);

    const tx = await pxe.simulateTx(txRequest, true);

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