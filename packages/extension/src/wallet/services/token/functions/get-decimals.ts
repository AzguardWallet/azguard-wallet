import type { Fr } from "@aztec/foundation/curves/bn254"
import { type ContractArtifact, type FunctionAbi, FunctionType } from "@aztec/stdlib/abi"
import { ViewFn } from "@/wallet/utils/fn"

export enum GetDecimalsImpl {
	DefaultPublic,
	DefaultPrivate,
}

export abstract class GetDecimalsFn extends ViewFn {
	public override buildArgs(): unknown[] {
		return []
	}

	public static new(name: string, impl: GetDecimalsImpl): GetDecimalsFn {
		switch (impl) {
			case GetDecimalsImpl.DefaultPublic:
				return new DefaultPublicGetDecimalsFn(name)
			case GetDecimalsImpl.DefaultPrivate:
				return new DefaultPrivateGetDecimalsFn(name)
			default:
				throw new Error("Invalid GetDecimalsImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
		const res = [...DefaultPublicGetDecimalsFn.getCandidates(artifact), ...DefaultPrivateGetDecimalsFn.getCandidates(artifact)]
		const points = (fn: GetDecimalsFn) => {
			switch (fn.name) {
				case "decimals":
					return 102
				case "private_get_decimals":
					return 101
				case "public_get_decimals":
					return 100
				default: {
					let p = 0
					if (fn.name.includes("decimals")) {
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

	public static getDefault(candidates: GetDecimalsFn[]): GetDecimalsFn | undefined {
		switch (candidates.at(0)?.name) {
			case "decimals":
			case "private_get_decimals":
			case "public_get_decimals":
				return candidates[0]
			default:
				return undefined
		}
	}
}

export class DefaultPublicGetDecimalsFn extends GetDecimalsFn {
	constructor(name: string) {
		super(name, GetDecimalsImpl.DefaultPublic)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isOnlySelf: false,
			isStatic: true,
			parameters: [],
			returnTypes: [{ kind: "integer", sign: "unsigned", width: 8 }],
			errorTypes: {},
		}
	}

	public override unpackResult(result: Fr[]): number {
		return result[0].toNumber()
	}

	public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
		const res = []
		for (const fn of artifact.nonDispatchPublicFunctions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "integer" &&
				fn.returnTypes[0].sign === "unsigned" &&
				fn.returnTypes[0].width === 8
			) {
				res.push(new DefaultPublicGetDecimalsFn(fn.name))
			}
		}
		return res
	}
}

export class DefaultPrivateGetDecimalsFn extends GetDecimalsFn {
	constructor(name: string) {
		super(name, GetDecimalsImpl.DefaultPrivate)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
			isOnlySelf: false,
			isStatic: true,
			parameters: [],
			returnTypes: [{ kind: "integer", sign: "unsigned", width: 8 }],
			errorTypes: {},
		}
	}

	public override unpackResult(result: Fr[]): number {
		return result[0].toNumber()
	}

	public static getCandidates(artifact: ContractArtifact): GetDecimalsFn[] {
		const res = []
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "integer" &&
				fn.returnTypes[0].sign === "unsigned" &&
				fn.returnTypes[0].width === 8
			) {
				res.push(new DefaultPrivateGetDecimalsFn(fn.name))
			}
		}
		return res
	}
}
