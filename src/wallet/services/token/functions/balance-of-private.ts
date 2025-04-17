import { Fr } from "@aztec/foundation/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
	ContractArtifact,
	FunctionAbi,
	FunctionType,
	IntegerType,
	StructType,
} from "@aztec/stdlib/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum BalanceOfPrivateImpl {
	Default,
}

export abstract class BalanceOfPrivateFn extends ViewFn {
	public override buildArgs(address: string | AztecAddress): any[] {
		return [address];
	}

	public static new(name: string, impl: BalanceOfPrivateImpl): BalanceOfPrivateFn {
		switch (impl) {
			case BalanceOfPrivateImpl.Default:
				return new DefaultBalanceOfPrivateFn(name);
			default:
				throw new Error("Invalid BalanceOfPrivateImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPrivateFn[] {
		const res = [...DefaultBalanceOfPrivateFn.getCandidates(artifact)];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("balance")) {
				p += 1;
				if (n.includes("balance_of_private")) {
					p += 2;
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: BalanceOfPrivateFn[]): BalanceOfPrivateFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "balance_of_private" ? candidates[0] : undefined;
	}
}

export class DefaultBalanceOfPrivateFn extends BalanceOfPrivateFn {
	constructor(name: string) {
		super(name, BalanceOfPrivateImpl.Default);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.UTILITY,
			isInternal: false,
			isStatic: false,
			parameters: [
				{
					name: "owner",
					type: {
						fields: [{ name: "inner", type: { kind: "field" } }],
						kind: "struct",
						path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
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
			errorTypes: {
				"16761564377371454734": {
					error_kind: "string",
					string: "Array index out of bounds",
				},
				"17843811134343075018": {
					error_kind: "string",
					string: "Stack too deep",
				},
				"206160798890201757": {
					error_kind: "string",
					string: "Storage slot 0 not allowed. Storage slots must start from 1.",
				},
				"5019202896831570965": {
					error_kind: "string",
					string: "attempt to add with overflow",
				},
				"5727012404371710682": {
					error_kind: "string",
					string: "push out of bounds",
				},
				"6485997221020871071": {
					error_kind: "string",
					string: "call to assert_max_bit_size",
				},
				"7233212735005103307": {
					error_kind: "string",
					string: "attempt to multiply with overflow",
				},
				"12099279057757775880": {
					error_kind: "string",
					string: "DST_LEN too large for offset",
				},
			},
		};
	}

	public override unpackResult(result: Fr[]): bigint {
		return result[0].toBigInt();
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPrivateFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				!fn.isStatic &&
				fn.functionType === FunctionType.UTILITY &&
				fn.parameters.length === 1 &&
				(fn.parameters[0].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "integer"
			) {
				res.push(new DefaultBalanceOfPrivateFn(fn.name));
			}
		}
		return res;
	}
}
