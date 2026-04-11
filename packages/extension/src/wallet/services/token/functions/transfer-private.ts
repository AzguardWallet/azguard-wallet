import { Fr } from "@aztec/foundation/curves/bn254"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { Fn } from "@/wallet/utils/fn"

export enum TransferPrivateImpl {
	Default,
	DefaultFrom,
}

export abstract class TransferPrivateFn extends Fn {
	public abstract override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint | string): unknown[]

	public static new(name: string, impl: TransferPrivateImpl): TransferPrivateFn {
		switch (impl) {
			case TransferPrivateImpl.Default:
				return new DefaultTransferPrivateFn(name)
			case TransferPrivateImpl.DefaultFrom:
				return new DefaultFromTransferPrivateFn(name)
			default:
				throw new Error("Invalid TransferPrivateImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
		const res = [...DefaultTransferPrivateFn.getCandidates(artifact), ...DefaultFromTransferPrivateFn.getCandidates(artifact)]
		const points = (fn: TransferPrivateFn) => {
			switch (fn.name) {
				case "transfer_private_to_private":
					return 102
				case "transfer":
					return 101
				case "transfer_in_private":
					return 100
				default: {
					let p = 0
					if (fn.name.includes("transfer")) {
						p += 1
						if (fn.name.includes("private")) {
							p += 2
							if (!fn.name.includes("public")) {
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

	public static getDefault(candidates: TransferPrivateFn[]): TransferPrivateFn | undefined {
		switch (candidates.at(0)?.name) {
			case "transfer_private_to_private":
			case "transfer":
			case "transfer_in_private":
				return candidates[0]
			default:
				return undefined
		}
	}
}

export class DefaultTransferPrivateFn extends TransferPrivateFn {
	constructor(name: string) {
		super(name, TransferPrivateImpl.Default)
	}

	public override buildArgs(_: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): unknown[] {
		return [to, amount]
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
			isOnlySelf: false,
			isStatic: false,
			parameters: [
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
			],
			returnTypes: [],
			errorTypes: {},
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
		const res = []
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 2 &&
				fn.parameters[0].name === "to" &&
				(fn.parameters[0].type as StructType)?.path === "aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[1].name === "amount" &&
				fn.parameters[1].type.kind === "integer" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPrivateFn(fn.name))
			}
		}
		return res
	}
}

export class DefaultFromTransferPrivateFn extends TransferPrivateFn {
	constructor(name: string) {
		super(name, TransferPrivateImpl.DefaultFrom)
	}

	public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): unknown[] {
		return [from, to, amount, Fr.zero()]
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
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

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
		const res = []
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
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
				res.push(new DefaultFromTransferPrivateFn(fn.name))
			}
		}
		return res
	}
}
