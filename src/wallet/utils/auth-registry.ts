import { CANONICAL_AUTH_REGISTRY_ADDRESS } from "@aztec/constants"
import { FunctionAbi, FunctionSelector } from "@aztec/stdlib/abi"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { PXE } from "@aztec/stdlib/interfaces/client"

export const getAuthRegistryAddress = () => AztecAddress.fromNumber(CANONICAL_AUTH_REGISTRY_ADDRESS)

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
	errorTypes: {},
} as FunctionAbi)

export const getSetAuthorizedSelector = async () => {
	const fn = getSetAuthorizedFn()
	return await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters)
}

export const isPublicAuthwitConsumable = async (pxe: PXE, owner: string, message_hash: string) => {
    const { result } = await pxe.simulateUtility("utility_is_consumable", [owner, message_hash], getAuthRegistryAddress());
    return result == true;
}
