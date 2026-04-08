import type { Fr } from "@aztec/foundation/curves/bn254"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import { type ContractArtifact, type FunctionAbi, FunctionType, type StructType } from "@aztec/stdlib/abi"
import { ViewFn } from "@/wallet/utils/fn"

export enum BalanceOfPrivateImpl {
	Default,
}

export abstract class BalanceOfPrivateFn extends ViewFn {
	public override buildArgs(address: string | AztecAddress): unknown[] {
		return [address]
	}

	public static new(name: string, impl: BalanceOfPrivateImpl): BalanceOfPrivateFn {
		switch (impl) {
			case BalanceOfPrivateImpl.Default:
				return new DefaultBalanceOfPrivateFn(name)
			default:
				throw new Error("Invalid BalanceOfPrivateImpl")
		}
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPrivateFn[] {
		const res = [...DefaultBalanceOfPrivateFn.getCandidates(artifact)]
		const points = (fn: BalanceOfPrivateFn) => {
			if (fn.name === "balance_of_private") {
				return 100
			}
			let p = 0
			if (fn.name.includes("balance")) {
				p += 1
				if (fn.name.includes("private")) {
					p += 2
				}
			}
			return p
		}
		res.sort((a, b) => points(b) - points(a))
		return res
	}

	public static getDefault(candidates: BalanceOfPrivateFn[]): BalanceOfPrivateFn | undefined {
		return candidates.at(0)?.name === "balance_of_private" ? candidates[0] : undefined
	}
}

export class DefaultBalanceOfPrivateFn extends BalanceOfPrivateFn {
	constructor(name: string) {
		super(name, BalanceOfPrivateImpl.Default)
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.UTILITY,
			isOnlySelf: false,
			isStatic: false,
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

	public static getCandidates(artifact: ContractArtifact): BalanceOfPrivateFn[] {
		const res = []
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isOnlySelf &&
				!fn.isStatic &&
				fn.functionType === FunctionType.UTILITY &&
				fn.parameters.length === 1 &&
				(fn.parameters[0].type as StructType)?.path === "aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "integer"
			) {
				res.push(new DefaultBalanceOfPrivateFn(fn.name))
			}
		}
		return res
	}
}
