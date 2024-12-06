import { AztecAddress, ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPrivateToPublicImpl {
	Default,
}

export abstract class TransferPrivateToPublicFn extends Fn {
	public override buildArgs(
		from: string | AztecAddress,
		to: string | AztecAddress,
		amount: number | bigint | string,
	): any[] {
		return [from, to, amount, Fr.zero()];
	}

	public static new(name: string, impl: TransferPrivateToPublicImpl): TransferPrivateToPublicFn {
		switch (impl) {
			case TransferPrivateToPublicImpl.Default:
				return new DefaultTransferPrivateToPublicFn(name);
			default:
				throw new Error("Invalid TransferPrivateToPublicImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPrivateToPublicFn[] {
		const res = [...DefaultTransferPrivateToPublicFn.getCandidates(artifact)];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("transfer")) {
				p += 1;
				if (n.includes("public")) {
					p += 2;
					if (n === "transfer_to_public") {
						p += 4;
					}
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: TransferPrivateToPublicFn[]): TransferPrivateToPublicFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "transfer_to_public" ? candidates[0] : undefined;
	}
}

export class DefaultTransferPrivateToPublicFn extends TransferPrivateToPublicFn {
	constructor(name: string) {
		super(name, TransferPrivateToPublicImpl.Default);
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
					type: { kind: "field" },
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
				"10132274202417587856": {
					error_kind: "string",
					string: "invalid nonce",
				},
				"10583567252049806039": {
					error_kind: "string",
					string: "Wrong collapsed vec order",
				},
				"11499495063250795588": {
					error_kind: "string",
					string: "Wrong collapsed vec content",
				},
				"11553125913047385813": {
					error_kind: "string",
					string: "Wrong collapsed vec length",
				},
				"14225679739041873922": {
					error_kind: "string",
					string: "Index out of bounds",
				},
				"1433889167918961673": {
					error_kind: "fmtstring",
					length: 17,
					item_types: [],
				},
				"14514982005979867414": {
					error_kind: "string",
					string: "attempt to bit-shift with overflow",
				},
				"15238796416211288225": {
					error_kind: "string",
					string: "Balance too low",
				},
				"15431201120282223247": {
					error_kind: "string",
					string: "Out of bounds index hint",
				},
				"16646908709298801123": {
					error_kind: "string",
					string: "attempt to subtract with underflow",
				},
				"16761564377371454734": {
					error_kind: "string",
					string: "Array index out of bounds",
				},
				"16954218183513903507": {
					error_kind: "string",
					string: "Attempted to read past end of BoundedVec",
				},
				"1705275289401561847": {
					error_kind: "string",
					string: "Mismatch note header storage slot.",
				},
				"17843811134343075018": {
					error_kind: "string",
					string: "Stack too deep",
				},
				"206160798890201757": {
					error_kind: "string",
					string: "Storage slot 0 not allowed. Storage slots must start from 1.",
				},
				"2429784973622283587": {
					error_kind: "string",
					string: "Can only emit a note log for an existing note.",
				},
				"2709101749560550278": {
					error_kind: "string",
					string: "Cannot serialize point at infinity as bytes.",
				},
				"2920182694213909827": {
					error_kind: "string",
					string: "attempt to subtract with overflow",
				},
				"4939791462094160055": {
					error_kind: "string",
					string: "Message not authorized by account",
				},
				"5019202896831570965": {
					error_kind: "string",
					string: "attempt to add with overflow",
				},
				"5641381842727637878": {
					error_kind: "string",
					string: "Got more notes than limit.",
				},
				"5672954975036048158": {
					error_kind: "string",
					string: "Collapse hint vec length mismatch",
				},
				"5727012404371710682": {
					error_kind: "string",
					string: "push out of bounds",
				},
				"6485997221020871071": {
					error_kind: "string",
					string: "call to assert_max_bit_size",
				},
				"6869395374906889440": {
					error_kind: "string",
					string: "Mismatch note header contract address.",
				},
				"7233212735005103307": {
					error_kind: "string",
					string: "attempt to multiply with overflow",
				},
				"7506220854563469239": {
					error_kind: "string",
					string: "Dirty collapsed vec storage",
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

	public static getCandidates(artifact: ContractArtifact): TransferPrivateToPublicFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				!fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 4 &&
				fn.parameters[0].name === "from" &&
				(fn.parameters[0].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[1].name === "to" &&
				(fn.parameters[1].type as StructType)?.path ===
					"authwit::aztec::protocol_types::address::aztec_address::AztecAddress" &&
				fn.parameters[2].name === "amount" &&
				fn.parameters[2].type.kind === "field" &&
				fn.parameters[3].name === "nonce" &&
				fn.parameters[3].type.kind === "field" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPrivateToPublicFn(fn.name));
			}
		}
		return res;
	}
}
