import { Fr } from "@aztec/foundation/curves/bn254"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { Fn } from "@/wallet/utils/fn"

export enum TransferPublicImpl {
	Default,
}

export abstract class TransferPublicFn extends Fn {
	public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint | string): unknown[] {
		return [from, to, amount, Fr.zero()]
	}

	public static new(name: string, impl: TransferPublicImpl): TransferPublicFn {
		switch (impl) {
			case TransferPublicImpl.Default:
				return new DefaultTransferPublicFn(name)
			default:
				throw new Error("Invalid TransferPublicImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPublicFn[] {
		const res = [...DefaultTransferPublicFn.getCandidates(artifact)]
		const points = (fn: TransferPublicFn) => {
			switch (fn.name) {
				case "transfer_public_to_public":
					return 102
				case "transfer_in_public":
					return 100
				default: {
					let p = 0
					if (fn.name.includes("transfer")) {
						p += 1
						if (fn.name.includes("public")) {
							p += 2
							if (!fn.name.includes("private")) {
								p += 4
							}
						}
					}
					return p
				}
			}
		}
		res.sort((a, b) => points(b) - points(a))
		return res
	}

	public static getDefault(candidates: TransferPublicFn[]): TransferPublicFn | undefined {
		switch (candidates.at(0)?.name) {
			case "transfer_public_to_public":
			case "transfer_in_public":
				return candidates[0]
			default:
				return undefined
		}
	}
}

export class DefaultTransferPublicFn extends TransferPublicFn {
	constructor(name: string) {
		super(name, TransferPublicImpl.Default)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isOnlySelf: false,
			isStatic: false,
			parameters: [
				{
					name: "from",
					type: {
						fields: [{ name: "inner", type: { kind: "field" } }],
						kind: "struct",
						path: "aztec::protocol_types::address::aztec_address::AztecAddress",
					},
					visibility: "private",
				},
				{
					name: "to",
					type: {
						fields: [{ name: "inner", type: { kind: "field" } }],
						kind: "struct",
						path: "aztec::protocol_types::address::aztec_address::AztecAddress",
					},
					visibility: "private",
				},
				{
					name: "amount",
					type: {
						kind: "integer",
						sign: "unsigned",
						width: 128,
					},
					visibility: "private",
				},
				{
					name: "authwit_nonce",
					type: { kind: "field" },
					visibility: "private",
				},
			],
			returnTypes: [],
			errorTypes: {},
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPublicFn[] {
		const res = []
		for (const fn of artifact.nonDispatchPublicFunctions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 4 &&
				fn.parameters[0].name === "from" &&
				(fn.parameters[0].type as StructType)?.path === "aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[1].name === "to" &&
				(fn.parameters[1].type as StructType)?.path === "aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[2].name === "amount" &&
				fn.parameters[2].type.kind === "integer" &&
				(fn.parameters[3].name === "authwit_nonce" || fn.parameters[3].name === "_nonce") &&
				fn.parameters[3].type.kind === "field" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPublicFn(fn.name))
			}
		}
		return res
	}
}
