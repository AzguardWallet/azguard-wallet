import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPrivateToPublicImpl {
    Default,
}

export abstract class TransferPrivateToPublicFn extends Fn {
    public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint | string): any[] {
        return [from, to, amount, Fr.zero()];
    }

    public static new(name: string, impl: TransferPrivateToPublicImpl): TransferPrivateToPublicFn {
        switch (impl) {
            case TransferPrivateToPublicImpl.Default:
                return new DefaultTransferPrivateToPublicFn(name);
            default:
                throw new Error('Invalid TransferPrivateToPublicImpl');
        }
    }

    public static getCandidates(artifact: ContractArtifact): TransferPrivateToPublicFn[] {
        const res = [
            ...DefaultTransferPrivateToPublicFn.getCandidates(artifact),
        ];
        const points = (n: string) => {
            let p = 0;
            if (n.includes("transfer")) {
                p += 1;
                if (n.includes("public")) {
                    p += 2;
                    if (n === "transfer_to_public") {
                        p += 4;
                    }
                }
            }
            return p;
        }
        res.sort((a, b) => points(b.name) - points(a.name));
        return res;
    }

    public static getDefault(candidates: TransferPrivateToPublicFn[]): TransferPrivateToPublicFn | undefined {
        return candidates[0].name === 'transfer_to_public' ? candidates[0] : undefined;
    }
}

export class DefaultTransferPrivateToPublicFn extends TransferPrivateToPublicFn {
    constructor(name: string) {
        super(name, TransferPrivateToPublicImpl.Default);
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

    public static getCandidates(artifact: ContractArtifact): TransferPrivateToPublicFn[] {
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
                res.push(new DefaultTransferPrivateToPublicFn(fn.name));
            }
        }
        return res;
    }
}