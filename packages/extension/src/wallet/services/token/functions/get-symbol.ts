import type { Fr } from "@aztec/foundation/curves/bn254"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { ViewFn } from "@/wallet/utils/fn"

export enum GetSymbolImpl {
	DefaultPublic,
	DefaultPrivate,
}

export abstract class GetSymbolFn extends ViewFn {
	public override buildArgs(): unknown[] {
		return []
	}

	public static new(name: string, impl: GetSymbolImpl): GetSymbolFn {
		switch (impl) {
			case GetSymbolImpl.DefaultPublic:
				return new DefaultPublicGetSymbolFn(name)
			case GetSymbolImpl.DefaultPrivate:
				return new DefaultPrivateGetSymbolFn(name)
			default:
				throw new Error("Invalid GetSymbolImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = [...DefaultPublicGetSymbolFn.getCandidates(artifact), ...DefaultPrivateGetSymbolFn.getCandidates(artifact)]
		const points = (fn: GetSymbolFn) => {
			switch (fn.name) {
				case "symbol":
					return 102
				case "private_get_symbol":
					return 101
				case "public_get_symbol":
					return 100
				default: {
					let p = 0
					if (fn.name.includes("symbol")) {
						p += 1
						if (fn.type === FunctionType.PRIVATE) {
							p += 2
						}
					}
					return p
				}
			}
		}
		res.sort((a, b) => points(b) - points(a))
		return res
	}

	public static getDefault(candidates: GetSymbolFn[]): GetSymbolFn | undefined {
		switch (candidates.at(0)?.name) {
			case "symbol":
			case "private_get_symbol":
			case "public_get_symbol":
				return candidates[0]
			default:
				return undefined
		}
	}
}

export class DefaultPublicGetSymbolFn extends GetSymbolFn {
	constructor(name: string) {
		super(name, GetSymbolImpl.DefaultPublic)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isOnlySelf: false,
			isStatic: true,
			parameters: [],
			returnTypes: [
				{
					fields: [{ name: "value", type: { kind: "field" } }],
					kind: "struct",
					path: "compressed_string::field_compressed_string::FieldCompressedString",
				},
			],
			errorTypes: {},
		}
	}

	public override unpackResult(result: Fr[]): string {
		return result[0].toBuffer().toString("utf-8").replaceAll("\u0000", "")
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = []
		for (const fn of artifact.nonDispatchPublicFunctions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				(fn.returnTypes[0] as StructType)?.path === "compressed_string::field_compressed_string::FieldCompressedString"
			) {
				res.push(new DefaultPublicGetSymbolFn(fn.name))
			}
		}
		return res
	}
}

export class DefaultPrivateGetSymbolFn extends GetSymbolFn {
	constructor(name: string) {
		super(name, GetSymbolImpl.DefaultPrivate)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
			isOnlySelf: false,
			isStatic: true,
			parameters: [],
			returnTypes: [
				{
					fields: [{ name: "value", type: { kind: "field" } }],
					kind: "struct",
					path: "compressed_string::field_compressed_string::FieldCompressedString",
				},
			],
			errorTypes: {},
		}
	}

	public override unpackResult(result: Fr[]): string {
		return result[0].toBuffer().toString("utf-8").replaceAll("\u0000", "")
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = []
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				(fn.returnTypes[0] as StructType)?.path === "compressed_string::field_compressed_string::FieldCompressedString"
			) {
				res.push(new DefaultPrivateGetSymbolFn(fn.name))
			}
		}
		return res
	}
}
