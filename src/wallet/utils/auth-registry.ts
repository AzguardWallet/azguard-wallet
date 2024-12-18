import { AztecAddress } from "@aztec/aztec.js"
import { FunctionAbi, FunctionSelector } from "@aztec/foundation/abi"

export const getAuthRegistryAddress = () => AztecAddress.fromBigInt(1n)

export const getSetAuthorizedFn = () => ({
	name: "set_authorized",
	functionType: "public",
	isInternal: false,
	isStatic: false,
	isInitializer: false,
	parameters: [
		{
			name: "message_hash",
			type: { kind: "field" },
			visibility: "private",
		},
		{
			name: "authorize",
			type: { kind: "boolean" },
			visibility: "private",
		},
	],
	returnTypes: [],
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
	},
} as FunctionAbi)

export const getSetAuthorizedSelector = () => {
	const fn = getSetAuthorizedFn()
	return FunctionSelector.fromNameAndParameters(fn.name, fn.parameters)
}
