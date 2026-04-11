import type { Fr } from "@aztec/foundation/curves/bn254"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { ViewFn } from "@/wallet/utils/fn"

export enum GetNameImpl {
	DefaultPublic,
	DefaultPrivate,
}

export abstract class GetNameFn extends ViewFn {
	public override buildArgs(): unknown[] {
		return []
	}

	public static new(name: string, impl: GetNameImpl): GetNameFn {
		switch (impl) {
			case GetNameImpl.DefaultPublic:
				return new DefaultPublicGetNameFn(name)
			case GetNameImpl.DefaultPrivate:
				return new DefaultPrivateGetNameFn(name)
			default:
				throw new Error("Invalid GetNameImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
		const res = [...DefaultPublicGetNameFn.getCandidates(artifact), ...DefaultPrivateGetNameFn.getCandidates(artifact)]
		const points = (fn: GetNameFn) => {
			switch (fn.name) {
				case "name":
					return 102
				case "private_get_name":
					return 101
				case "public_get_name":
					return 100
				default: {
					let p = 0
					if (fn.name.includes("name")) {
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

	public static getDefault(candidates: GetNameFn[]): GetNameFn | undefined {
		switch (candidates.at(0)?.name) {
			case "name":
			case "private_get_name":
			case "public_get_name":
				return candidates[0]
			default:
				return undefined
		}
	}
}

export class DefaultPublicGetNameFn extends GetNameFn {
	constructor(name: string) {
		super(name, GetNameImpl.DefaultPublic)
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

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
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
				res.push(new DefaultPublicGetNameFn(fn.name))
			}
		}
		return res
	}
}

export class DefaultPrivateGetNameFn extends GetNameFn {
	constructor(name: string) {
		super(name, GetNameImpl.DefaultPrivate)
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

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
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
				res.push(new DefaultPrivateGetNameFn(fn.name))
			}
		}
		return res
	}
}
