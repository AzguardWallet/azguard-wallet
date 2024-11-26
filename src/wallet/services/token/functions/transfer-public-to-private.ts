import { AztecAddress, ContractArtifact } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPublicToPrivateImpl {
    Default,
}

export abstract class TransferPublicToPrivateFn extends Fn {
    public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint | string): any[] {
        return [to, amount];
    }

    public static new(name: string, impl: TransferPublicToPrivateImpl): TransferPublicToPrivateFn {
        switch (impl) {
            case TransferPublicToPrivateImpl.Default:
                return new DefaultTransferPublicToPrivateFn(name);
            default:
                throw new Error('Invalid TransferPublicToPrivateImpl');
        }
    }

    public static getCandidates(artifact: ContractArtifact): TransferPublicToPrivateFn[] {
        const res = [
            ...DefaultTransferPublicToPrivateFn.getCandidates(artifact),
        ];
        const points = (n: string) => {
            let p = 0;
            if (n.includes("transfer")) {
                p += 1;
                if (n.includes("private")) {
                    p += 2;
                    if (n === "transfer_to_private") {
                        p += 4;
                    }
                }
            }
            return p;
        }
        res.sort((a, b) => points(b.name) - points(a.name));
        return res;
    }

    public static getDefault(candidates: TransferPublicToPrivateFn[]): TransferPublicToPrivateFn | undefined {
        return candidates[0].name === 'transfer_to_private' ? candidates[0] : undefined;
    }
}

export class DefaultTransferPublicToPrivateFn extends TransferPublicToPrivateFn {
    constructor(name: string) {
        super(name, TransferPublicToPrivateImpl.Default);
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

    public static getCandidates(artifact: ContractArtifact): TransferPublicToPrivateFn[] {
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
                res.push(new DefaultTransferPublicToPrivateFn(fn.name));
            }
        }
        return res;
    }
}