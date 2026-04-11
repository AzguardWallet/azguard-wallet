import type { Fr } from "@aztec/foundation/curves/bn254"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { ViewFn } from "@/wallet/utils/fn"

export enum BalanceOfPublicImpl {
	Default,
}

export abstract class BalanceOfPublicFn extends ViewFn {
	public override buildArgs(address: string | AztecAddress): unknown[] {
		return [address]
	}

	public static new(name: string, impl: BalanceOfPublicImpl): BalanceOfPublicFn {
		switch (impl) {
			case BalanceOfPublicImpl.Default:
				return new DefaultBalanceOfPublicFn(name)
			default:
				throw new Error("Invalid BalanceOfPublicImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
		const res = [...DefaultBalanceOfPublicFn.getCandidates(artifact)]
		const points = (fn: BalanceOfPublicFn) => {
			if (fn.name === "balance_of_public") {
				return 100
			}
			let p = 0
			if (fn.name.includes("balance")) {
				p += 1
				if (fn.name.includes("public")) {
					p += 2
				}
			}
			return p
		}
		res.sort((a, b) => points(b) - points(a))
		return res
	}

	public static getDefault(candidates: BalanceOfPublicFn[]): BalanceOfPublicFn | undefined {
		return candidates.at(0)?.name === "balance_of_public" ? candidates[0] : undefined
	}
}

export class DefaultBalanceOfPublicFn extends BalanceOfPublicFn {
	constructor(name: string) {
		super(name, BalanceOfPublicImpl.Default)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isOnlySelf: false,
			isStatic: true,
			parameters: [
				{
					name: "owner",
					type: {
						fields: [{ name: "inner", type: { kind: "field" } }],
						kind: "struct",
						path: "aztec::protocol_types::address::aztec_address::AztecAddress",
					},
					visibility: "private",
				},
			],
			returnTypes: [
				{
					kind: "integer",
					sign: "unsigned",
					width: 128,
				},
			],
			errorTypes: {},
		}
	}

	public override unpackResult(result: Fr[]): bigint {
		return result[0].toBigInt()
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
		const res = []
		for (const fn of artifact.nonDispatchPublicFunctions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 1 &&
				(fn.parameters[0].type as StructType)?.path === "aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "integer"
			) {
				res.push(new DefaultBalanceOfPublicFn(fn.name))
			}
		}
		return res
	}
}
