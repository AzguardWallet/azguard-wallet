import { Fr, FunctionSelector, PackedValues } from "@aztec/aztec.js";
import { encodeArguments, FunctionAbi, FunctionType } from "@aztec/foundation/abi";

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