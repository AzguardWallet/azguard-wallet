import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum BalanceOfPublicImpl {
	Default,
}

export abstract class BalanceOfPublicFn extends ViewFn {
	public override buildArgs(address: string | AztecAddress): any[] {
		return [address];
	}

	public static new(name: string, impl: BalanceOfPublicImpl): BalanceOfPublicFn {
		switch (impl) {
			case BalanceOfPublicImpl.Default:
				return new DefaultBalanceOfPublicFn(name);
			default:
				throw new Error("Invalid BalanceOfPublicImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
		const res = [...DefaultBalanceOfPublicFn.getCandidates(artifact)];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("balance")) {
				p += 1;
				if (n.includes("balance_of_public")) {
					p += 2;
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: BalanceOfPublicFn[]): BalanceOfPublicFn | undefined {
		return candidates[0].name === "balance_of_public" ? candidates[0] : undefined;
	}
}

export class DefaultBalanceOfPublicFn extends BalanceOfPublicFn {
	constructor(name: string) {
		super(name, BalanceOfPublicImpl.Default);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isInternal: false,
			isStatic: true,
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
			returnTypes: [{ kind: "field" }],
			errorTypes: {
				"13699457482007836410": {
					error_kind: "string",
					string: "Not initialized",
				},
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
				"6067862452620309358": {
					error_kind: "string",
					string: "Function balance_of_public can only be called statically",
				},
				"6485997221020871071": {
					error_kind: "string",
					string: "call to assert_max_bit_size",
				},
			},
		};
	}

	public override unpackResult(result: Fr[]): bigint {
		return result[0].toBigInt();
	}

	public static getCandidates(artifact: ContractArtifact): BalanceOfPublicFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 1 &&
				(fn.parameters[0].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.returnTypes.length === 1 &&
				fn.returnTypes[0].kind === "field"
			) {
				res.push(new DefaultBalanceOfPublicFn(fn.name));
			}
		}
		return res;
	}
}
