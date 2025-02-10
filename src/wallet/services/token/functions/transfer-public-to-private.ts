import { AztecAddress, ContractArtifact } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPublicToPrivateImpl {
	Default,
}

export abstract class TransferPublicToPrivateFn extends Fn {
	public override buildArgs(
		from: string | AztecAddress,
		to: string | AztecAddress,
		amount: number | bigint | string,
	): any[] {
		return [to, amount];
	}

	public static new(name: string, impl: TransferPublicToPrivateImpl): TransferPublicToPrivateFn {
		switch (impl) {
			case TransferPublicToPrivateImpl.Default:
				return new DefaultTransferPublicToPrivateFn(name);
			default:
				throw new Error("Invalid TransferPublicToPrivateImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPublicToPrivateFn[] {
		const res = [...DefaultTransferPublicToPrivateFn.getCandidates(artifact)];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("transfer")) {
				p += 1;
				if (n.includes("private")) {
					p += 2;
					if (n === "transfer_to_private") {
						p += 4;
					}
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: TransferPublicToPrivateFn[]): TransferPublicToPrivateFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "transfer_to_private" ? candidates[0] : undefined;
	}
}

export class DefaultTransferPublicToPrivateFn extends TransferPublicToPrivateFn {
	constructor(name: string) {
		super(name, TransferPublicToPrivateImpl.Default);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
			isInternal: false,
			isStatic: false,
			parameters: [
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

	public static getCandidates(artifact: ContractArtifact): TransferPublicToPrivateFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 2 &&
				fn.parameters[0].name === "to" &&
				(fn.parameters[0].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[1].name === "amount" &&
				(fn.parameters[1].type as StructType)?.path === "std::uint128::U128" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPublicToPrivateFn(fn.name));
			}
		}
		return res;
	}
}
