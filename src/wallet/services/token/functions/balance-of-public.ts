import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum BalanceOfPublicImpl {
    Default,
}

export abstract class BalanceOfPublicFn extends ViewFn {
    public override buildArgs(address: string | AztecAddress): any[] {
        return [address];
    }

    public static new(name: string, impl: BalanceOfPublicImpl): BalanceOfPublicFn {
        switch (impl) {
            case BalanceOfPublicImpl.Default:
                return new DefaultBalanceOfPublicFn(name);
            default:
                throw new Error('Invalid BalanceOfPublicImpl');
        }
    }

    public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
        const res = [
            ...DefaultBalanceOfPublicFn.getCandidates(artifact),
        ];
        const points = (n: string) => {
            let p = 0;
            if (n.includes("balance")) {
                p += 1;
                if (n.includes("balance_of_public")) {
                    p += 2;
                }
            }
            return p;
        }
        res.sort((a, b) => points(b.name) - points(a.name));
        return res;
    }

    public static getDefault(candidates: BalanceOfPublicFn[]): BalanceOfPublicFn | undefined {
        return candidates[0].name === 'balance_of_public' ? candidates[0] : undefined;
    }
}

export class DefaultBalanceOfPublicFn extends BalanceOfPublicFn {
    constructor(name: string) {
        super(name, BalanceOfPublicImpl.Default);
    }

    protected override abi(): FunctionAbi {
        return {
            name: this.name,
            isInitializer: false,
            functionType: FunctionType.PUBLIC,
            isInternal: false,
            isStatic: true,
            parameters: [
                {
                    name: "owner",
                    type: {
                        fields: [{ name: "inner", type: { kind: "field" } }],
                        kind: "struct",
                        path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
                    },
                    visibility: "private",
                }
            ],
            returnTypes: [{ kind: "field" }],
        };
    }

    public override unpackResult(result: Fr[]): bigint {
        return result[0].toBigInt();
    }

    public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
        const res = [];
        for (const fn of artifact.functions) {
            if (!fn.isInitializer &&
                !fn.isInternal &&
                fn.isStatic &&
                fn.functionType === FunctionType.PUBLIC &&
                fn.parameters.length === 1 &&
                (fn.parameters[0].type as StructType)?.path === "authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
                fn.returnTypes.length === 1 &&
                fn.returnTypes[0].kind === "field"
            ) {
                res.push(new DefaultBalanceOfPublicFn(fn.name));
            }
        }
        return res;
    }
}