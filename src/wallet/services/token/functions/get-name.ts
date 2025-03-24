import { Fr } from "@aztec/foundation/fields";
import {
	ContractArtifact,
	FunctionAbi,
	FunctionType,
	StructType,
} from "@aztec/stdlib/abi";
import { ViewFn } from "@/wallet/utils/fn";

export enum GetNameImpl {
	DefaultPublic,
	DefaultPrivate,
}

export abstract class GetNameFn extends ViewFn {
	public override buildArgs(): any[] {
		return [];
	}

	public static new(name: string, impl: GetNameImpl): GetNameFn {
		switch (impl) {
			case GetNameImpl.DefaultPublic:
				return new DefaultPublicGetNameFn(name);
			case GetNameImpl.DefaultPrivate:
				return new DefaultPrivateGetNameFn(name);
			default:
				throw new Error("Invalid GetNameImpl");
		}
	}

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
		const res = [
			...DefaultPublicGetNameFn.getCandidates(artifact),
			...DefaultPrivateGetNameFn.getCandidates(artifact),
		];
		const points = (n: string) => {
			let p = 0;
			if (n.includes("name")) {
				p += 1;
				if (n.includes("get_name")) {
					p += 2;
					if (n.includes("public_get_name")) {
						p += 4;
					} else if (n.includes("private_get_name")) {
						p += 8;
					}
				}
			}
			return p;
		};
		res.sort((a, b) => points(b.name) - points(a.name));
		return res;
	}

	public static getDefault(candidates: GetNameFn[]): GetNameFn | undefined {
		if (!candidates.length) return undefined;
		return candidates[0].name === "private_get_name" || candidates[0].name === "public_get_name"
			? candidates[0]
			: undefined;
	}
}

export class DefaultPublicGetNameFn extends GetNameFn {
	constructor(name: string) {
		super(name, GetNameImpl.DefaultPublic);
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
				"17843811134343075018": {
					error_kind: "string",
					string: "Stack too deep",
				},
				"18105278452957613314": {
					error_kind: "string",
					string: "Function public_get_name can only be called statically",
				},
			},
		};
	}

	public override unpackResult(result: Fr[]): string {
		return result[0].toBuffer().toString("utf-8").replaceAll("\u0000", "");
	}

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
		const res = [];
		for (const fn of artifact.nonDispatchPublicFunctions) {
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
				res.push(new DefaultPublicGetNameFn(fn.name));
			}
		}
		return res;
	}
}

export class DefaultPrivateGetNameFn extends GetNameFn {
	constructor(name: string) {
		super(name, GetNameImpl.DefaultPrivate);
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
				"2111772463301017956": {
					error_kind: "string",
					string: "Function private_get_name can only be called statically",
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

	public static getCandidates(artifact: ContractArtifact): GetNameFn[] {
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
				res.push(new DefaultPrivateGetNameFn(fn.name));
			}
		}
		return res;
	}
}
