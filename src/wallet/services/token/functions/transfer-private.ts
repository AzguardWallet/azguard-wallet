import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPrivateImpl {
    Default,
    DefaultFrom,
}

export abstract class TransferPrivateFn extends Fn {
    public abstract override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): any[];

    public static new(name: string, impl: TransferPrivateImpl): TransferPrivateFn {
        switch (impl) {
            case TransferPrivateImpl.Default:
                return new DefaultTransferPrivateFn(name);
            case TransferPrivateImpl.DefaultFrom:
                return new DefaultFromTransferPrivateFn(name);
            default:
                throw new Error('Invalid TransferPrivateImpl');
        }
    }

    public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
        const res = [
            ...DefaultTransferPrivateFn.getCandidates(artifact),
            ...DefaultFromTransferPrivateFn.getCandidates(artifact),
        ];
        const points = (n: string) => {
            let p = 0;
            if (n.includes("transfer")) {
                p += 1;
                if (n === "transfer_from") {
                    p += 2;
                }
                else if (n === "transfer") {
                    p += 4;
                }
            }
            return p;
        }
        res.sort((a, b) => points(b.name) - points(a.name));
        return res;
    }

    public static getDefault(candidates: TransferPrivateFn[]): TransferPrivateFn | undefined {
        return candidates[0].name === 'transfer' || candidates[0].name === 'transfer_from' ? candidates[0] : undefined;
    }
}

export class DefaultTransferPrivateFn extends TransferPrivateFn {
    constructor(name: string) {
        super(name, TransferPrivateImpl.Default);
    }
    
    public override buildArgs(_: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): any[] {
        return [to, amount];
    }

    protected override abi(): FunctionAbi {
        return {
            name: this.name,
            isInitializer: false,
            functionType: FunctionType.PRIVATE,
            isInternal: false,
            isStatic: false,
            parameters: [
                {
                    name: "to",
                    type: {
                        fields: [{ name: "inner", type: { kind: "field" } }],
                        kind: "struct",
                        path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
                    },
                    visibility: "private",
                },
                {
                    name: "amount",
                    type: { kind: "field" },
                    visibility: "private",
                },
            ],
            returnTypes: [],
        };
    }

    public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
        const res = [];
        for (const fn of artifact.functions) {
            if (!fn.isInitializer &&
                !fn.isInternal &&
                !fn.isStatic &&
                fn.functionType === FunctionType.PRIVATE &&
                fn.parameters.length === 2 &&
                fn.parameters[0].name === "to" &&
                (fn.parameters[0].type as StructType)?.path === "authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
                fn.parameters[1].name === "amount" &&
                fn.parameters[1].type.kind === "field" &&
                fn.returnTypes.length === 0
            ) {
                res.push(new DefaultTransferPrivateFn(fn.name));
            }
        }
        return res;
    }
}

export class DefaultFromTransferPrivateFn extends TransferPrivateFn {
    constructor(name: string) {
        super(name, TransferPrivateImpl.DefaultFrom);
    }
    
    public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): any[] {
        return [from, to, amount, Fr.zero()];
    }

    protected override abi(): FunctionAbi {
        return {
            name: this.name,
            isInitializer: false,
            functionType: FunctionType.PRIVATE,
            isInternal: false,
            isStatic: false,
            parameters: [
                {
                    name: "from",
                    type: {
                        fields: [{ name: "inner", type: { kind: "field" } }],
                        kind: "struct",
                        path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
                    },
                    visibility: "private",
                },
                {
                    name: "to",
                    type: {
                        fields: [{ name: "inner", type: { kind: "field" } }],
                        kind: "struct",
                        path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
                    },
                    visibility: "private",
                },
                {
                    name: "amount",
                    type: { kind: "field" },
                    visibility: "private",
                },
                {
                    name: "nonce",
                    type: { kind: "field" },
                    visibility: "private",
                },
            ],
            returnTypes: [],
        };
    }

    public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
        const res = [];
        for (const fn of artifact.functions) {
            if (!fn.isInitializer &&
                !fn.isInternal &&
                !fn.isStatic &&
                fn.functionType === FunctionType.PRIVATE &&
                fn.parameters.length === 4 &&
                fn.parameters[0].name === "from" &&
                (fn.parameters[0].type as StructType)?.path === "authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
                fn.parameters[1].name === "to" &&
                (fn.parameters[1].type as StructType)?.path === "authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
                fn.parameters[2].name === "amount" &&
                fn.parameters[2].type.kind === "field" &&
                fn.parameters[3].name === "nonce" &&
                fn.parameters[3].type.kind === "field" &&
                fn.returnTypes.length === 0
            ) {
                res.push(new DefaultFromTransferPrivateFn(fn.name));
            }
        }
        return res;
    }
}