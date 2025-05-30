import { Fr } from "@aztec/foundation/fields";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
	ContractArtifact,
	FunctionAbi,
	FunctionType,
	StructType,
} from "@aztec/stdlib/abi";
import { Fn } from "@/wallet/utils/fn";

export enum TransferPrivateImpl {
	Default,
	DefaultFrom,
}

export abstract class TransferPrivateFn extends Fn {
	public abstract override buildArgs(
		from: string | AztecAddress,
		to: string | AztecAddress,
		amount: number | bigint | string,
	): any[];

	public static new(name: string, impl: TransferPrivateImpl): TransferPrivateFn {
		switch (impl) {
			case TransferPrivateImpl.Default:
				return new DefaultTransferPrivateFn(name);
			case TransferPrivateImpl.DefaultFrom:
				return new DefaultFromTransferPrivateFn(name);
			default:
				throw new Error("Invalid TransferPrivateImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
		const res = [
			...DefaultTransferPrivateFn.getCandidates(artifact),
			...DefaultFromTransferPrivateFn.getCandidates(artifact),
		];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("transfer")) {
				p += 1;
				if (n === "transfer_in_private") {
					p += 2;
				} else if (n === "transfer") {
					p += 4;
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: TransferPrivateFn[]): TransferPrivateFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "transfer" || candidates[0].name === "transfer_in_private" ? candidates[0] : undefined;
	}
}

export class DefaultTransferPrivateFn extends TransferPrivateFn {
	constructor(name: string) {
		super(name, TransferPrivateImpl.Default);
	}

	public override buildArgs(_: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): any[] {
		return [to, amount];
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
						kind: "integer",
						sign: "unsigned",
						width: 128,
					},
					visibility: "private",
				},
			],
			returnTypes: [],
			errorTypes: {
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

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
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
				fn.parameters[1].type.kind === "integer" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultTransferPrivateFn(fn.name));
			}
		}
		return res;
	}
}

export class DefaultFromTransferPrivateFn extends TransferPrivateFn {
	constructor(name: string) {
		super(name, TransferPrivateImpl.DefaultFrom);
	}

	public override buildArgs(from: string | AztecAddress, to: string | AztecAddress, amount: number | bigint): any[] {
		return [from, to, amount, Fr.zero()];
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
					type: {
						kind: "integer",
						sign: "unsigned",
						width: 128,
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

	public static getCandidates(artifact: ContractArtifact): TransferPrivateFn[] {
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
				fn.parameters[2].type.kind === "integer" &&
				fn.parameters[3].name === "nonce" &&
				fn.parameters[3].type.kind === "field" &&
				fn.returnTypes.length === 0
			) {
				res.push(new DefaultFromTransferPrivateFn(fn.name));
			}
		}
		return res;
	}
}
