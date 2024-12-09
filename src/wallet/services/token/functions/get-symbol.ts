import { ContractArtifact, Fr } from "@aztec/aztec.js";
import { FunctionAbi, FunctionType, StructType } from "@aztec/foundation/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum GetSymbolImpl {
	DefaultPublic,
	DefaultPrivate,
}

export abstract class GetSymbolFn extends ViewFn {
	public override buildArgs(): any[] {
		return [];
	}

	public static new(name: string, impl: GetSymbolImpl): GetSymbolFn {
		switch (impl) {
			case GetSymbolImpl.DefaultPublic:
				return new DefaultPublicGetSymbolFn(name);
			case GetSymbolImpl.DefaultPrivate:
				return new DefaultPrivateGetSymbolFn(name);
			default:
				throw new Error("Invalid GetSymbolImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = [
			...DefaultPublicGetSymbolFn.getCandidates(artifact),
			...DefaultPrivateGetSymbolFn.getCandidates(artifact),
		];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("symbol")) {
				p += 1;
				if (n.includes("get_symbol")) {
					p += 2;
					if (n.includes("public_get_symbol")) {
						p += 4;
					} else if (n.includes("private_get_symbol")) {
						p += 8;
					}
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: GetSymbolFn[]): GetSymbolFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "private_get_symbol" || candidates[0].name === "public_get_symbol"
			? candidates[0]
			: undefined;
	}
}

export class DefaultPublicGetSymbolFn extends GetSymbolFn {
	constructor(name: string) {
		super(name, GetSymbolImpl.DefaultPublic);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PUBLIC,
			isInternal: false,
			isStatic: true,
			parameters: [],
			returnTypes: [
				{
					fields: [{ name: "value", type: { kind: "field" } }],
					kind: "struct",
					path: "compressed_string::field_compressed_string::FieldCompressedString",
				},
			],
			errorTypes: {
				"13699457482007836410": {
					error_kind: "string",
					string: "Not initialized",
				},
				"15009911310769716579": {
					error_kind: "string",
					string: "Function public_get_symbol can only be called statically",
				},
				"17843811134343075018": {
					error_kind: "string",
					string: "Stack too deep",
				},
			},
		};
	}

	public override unpackResult(result: Fr[]): string {
		return result[0].toBuffer().toString("utf-8").replaceAll("\u0000", "");
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				fn.isStatic &&
				fn.functionType === FunctionType.PUBLIC &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				(fn.returnTypes[0] as StructType)?.path ===
					"compressed_string::field_compressed_string::FieldCompressedString"
			) {
				res.push(new DefaultPublicGetSymbolFn(fn.name));
			}
		}
		return res;
	}
}

export class DefaultPrivateGetSymbolFn extends GetSymbolFn {
	constructor(name: string) {
		super(name, GetSymbolImpl.DefaultPrivate);
	}

	protected override abi(): FunctionAbi {
		return {
			name: this.name,
			isInitializer: false,
			functionType: FunctionType.PRIVATE,
			isInternal: false,
			isStatic: true,
			parameters: [],
			returnTypes: [
				{
					fields: [{ name: "value", type: { kind: "field" } }],
					kind: "struct",
					path: "compressed_string::field_compressed_string::FieldCompressedString",
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
				"18192277837884173995": {
					error_kind: "string",
					string: "Function private_get_symbol can only be called statically",
				},
				"5019202896831570965": {
					error_kind: "string",
					string: "attempt to add with overflow",
				},
				"6485997221020871071": {
					error_kind: "string",
					string: "call to assert_max_bit_size",
				},
				"7764445047318889914": {
					error_kind: "string",
					string: "Public data tree index doesn't match witness",
				},
				"9199403315589104763": {
					error_kind: "string",
					string: "Proving public value inclusion failed",
				},
			},
		};
	}

	public override unpackResult(result: Fr[]): string {
		return result[0].toBuffer().toString("utf-8").replaceAll("\u0000", "");
	}

	public static getCandidates(artifact: ContractArtifact): GetSymbolFn[] {
		const res = [];
		for (const fn of artifact.functions) {
			if (
				!fn.isInitializer &&
				!fn.isInternal &&
				fn.isStatic &&
				fn.functionType === FunctionType.PRIVATE &&
				fn.parameters.length === 0 &&
				fn.returnTypes.length === 1 &&
				(fn.returnTypes[0] as StructType)?.path ===
					"compressed_string::field_compressed_string::FieldCompressedString"
			) {
				res.push(new DefaultPrivateGetSymbolFn(fn.name));
			}
		}
		return res;
	}
}
