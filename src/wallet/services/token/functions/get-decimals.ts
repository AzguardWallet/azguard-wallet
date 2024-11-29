import { ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType } from "@aztec/foundation/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum GetDecimalsImpl {
    DefaultPublic,
    DefaultPrivate,
}

export abstract class GetDecimalsFn extends ViewFn {
    public override buildArgs(): any[] {
        return [];
    }

    public static new(name: string, impl: GetDecimalsImpl): GetDecimalsFn {
        switch (impl) {
            case GetDecimalsImpl.DefaultPublic:
                return new DefaultPublicGetDecimalsFn(name);
            case GetDecimalsImpl.DefaultPrivate:
                return new DefaultPrivateGetDecimalsFn(name);
            default:
                throw new Error('Invalid GetDecimalsImpl');
        }
    }

    public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
        const res = [
            ...DefaultPublicGetDecimalsFn.getCandidates(artifact),
            ...DefaultPrivateGetDecimalsFn.getCandidates(artifact),
        ];
        const points = (n: string) => {
            let p = 0;
            if (n.includes("decimals")) {
                p += 1;
                if (n.includes("get_decimals")) {
                    p += 2;
                    if (n.includes("public_get_decimals")) {
                        p += 4;
                    }
                    else if (n.includes("private_get_decimals")) {
                        p += 8;
                    }
                }
            }
            return p;
        }
        res.sort((a, b) => points(b.name) - points(a.name));
        return res;
    }

    public static getDefault(candidates: GetDecimalsFn[]): GetDecimalsFn | undefined {
        return candidates[0].name === 'private_get_decimals' || candidates[0].name === 'public_get_decimals' ? candidates[0] : undefined;
    }
}

export class DefaultPublicGetDecimalsFn extends GetDecimalsFn {
    constructor(name: string) {
        super(name, GetDecimalsImpl.DefaultPublic);
    }

    protected override abi(): FunctionAbi {
        return {
            name: this.name,
            isInitializer: false,
            functionType: FunctionType.PUBLIC,
            isInternal: false,
            isStatic: true,
            parameters: [],
            returnTypes: [{ kind: "integer", sign: "unsigned", width: 8 }],
        };
    }

    public override unpackResult(result: Fr[]): number {
        return result[0].toNumber();
    }

    public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
        const res = [];
        for (const fn of artifact.functions) {
            if (!fn.isInitializer &&
                !fn.isInternal &&
                fn.isStatic &&
                fn.functionType === FunctionType.PUBLIC &&
                fn.parameters.length === 0 &&
                fn.returnTypes.length === 1 &&
                fn.returnTypes[0].kind === "integer" &&
                fn.returnTypes[0].sign === "unsigned" &&
                fn.returnTypes[0].width === 8
            ) {
                res.push(new DefaultPublicGetDecimalsFn(fn.name));
            }
        }
        return res;
    }
}

export class DefaultPrivateGetDecimalsFn extends GetDecimalsFn {
    constructor(name: string) {
        super(name, GetDecimalsImpl.DefaultPrivate);
    }

    protected override abi(): FunctionAbi {
        return {
            name: this.name,
            isInitializer: false,
            functionType: FunctionType.PRIVATE,
            isInternal: false,
            isStatic: true,
            parameters: [],
            returnTypes: [{ kind: "integer", sign: "unsigned", width: 8 }],
        };
    }

    public override unpackResult(result: Fr[]): number {
        return result[0].toNumber();
    }

    public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
        const res = [];
        for (const fn of artifact.functions) {
            if (!fn.isInitializer &&
                !fn.isInternal &&
                fn.isStatic &&
                fn.functionType === FunctionType.PRIVATE &&
                fn.parameters.length === 0 &&
                fn.returnTypes.length === 1 &&
                fn.returnTypes[0].kind === "integer" &&
                fn.returnTypes[0].sign === "unsigned" &&
                fn.returnTypes[0].width === 8
            ) {
                res.push(new DefaultPrivateGetDecimalsFn(fn.name));
            }
        }
        return res;
    }
}