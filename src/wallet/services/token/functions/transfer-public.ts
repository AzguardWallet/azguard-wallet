import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPublicImpl {
	Default,
}

export abstract class TransferPublicFn extends Fn {
	public override buildArgs(
		from: string | AztecAddress,
		to: string | AztecAddress,
		amount: number | bigint | string,
	): any[] {
		return [from, to, amount, Fr.zero()];
	}

	public static new(name: string, impl: TransferPublicImpl): TransferPublicFn {
		switch (impl) {
			case TransferPublicImpl.Default:
				return new DefaultTransferPublicFn(name);
			default:
				throw new Error("Invalid TransferPublicImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPublicFn[] {
		const res = [...DefaultTransferPublicFn.getCandidates(artifact)];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("transfer")) {
				p += 1;
				if (n.includes("public")) {
					p += 2;
					if (n === "transfer_in_public") {
						p += 4;
					}
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: TransferPublicFn[]): TransferPublicFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "transfer_in_public" ? candidates[0] : undefined;
	}
}

export class DefaultTransferPublicFn extends TransferPublicFn {
	constructor(name: string) {
		super(name, TransferPublicImpl.Default);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isInternal: false,
			isStatic: false,
			parameters: [
				{
					name: "from",
					type: {
						fields: [{ name: "inner", type: { kind: "field" } }],
						kind: "struct",
						path: "authwit::aztec::protocol_types::address::aztec_address::AztecAddress",
					},
					visibility: "private",
				},
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
					type: {
						fields: [
							{ name: "lo", type: { kind: "field" } },
							{ name: "hi", type: { kind: "field" } },
						],
						kind: "struct",
						path: "std::uint128::U128",
					},
					visibility: "private",
				},
				{
					name: "nonce",
					type: { kind: "field" },
					visibility: "private",
				},
			],
			returnTypes: [],
			errorTypes: {
				"14514982005979867414": {
					error_kind: "string",
					string: "attempt to bit-shift with overflow",
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
				"2709101749560550278": {
					error_kind: "string",
					string: "Cannot serialize point at infinity as bytes.",
				},
				"2920182694213909827": {
					error_kind: "string",
					string: "attempt to subtract with overflow",
				},
				"5019202896831570965": {
					error_kind: "string",
					string: "attempt to add with overflow",
				},
				"6485997221020871071": {
					error_kind: "string",
					string: "call to assert_max_bit_size",
				},
				"7233212735005103307": {
					error_kind: "string",
					string: "attempt to multiply with overflow",
				},
				"8193989641828211937": {
					error_kind: "string",
					string: "ciphertext length mismatch",
				},
				"8270195893599566439": {
					error_kind: "string",
					string: "Invalid public keys hint for address",
				},
			},
		};
	}

	public static getCandidates(artifact: ContractArtifact): TransferPublicFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 4 &&
				fn.parameters[0].name === "from" &&
				(fn.parameters[0].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[1].name === "to" &&
				(fn.parameters[1].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[2].name === "amount" &&
				(fn.parameters[2].type as StructType)?.path === "std::uint128::U128" &&
				fn.parameters[3].name === "nonce" &&
				fn.parameters[3].type.kind === "field" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPublicFn(fn.name));
			}
		}
		return res;
	}
}
