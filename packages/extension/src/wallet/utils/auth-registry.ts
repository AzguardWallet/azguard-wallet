import { CANONICAL_AUTH_REGISTRY_ADDRESS } from "@aztec/constants"
import { Fr } from "@aztec/foundation/curves/bn254"
import { type FunctionAbi, FunctionSelector, FunctionType } from "@aztec/stdlib/abi"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash"
import type { AztecNode } from "@aztec/stdlib/interfaces/client"

// Auth Registry storage slots (derived from Noir contract storage layout)
const APPROVED_ACTIONS_SLOT = new Fr(1)
const REJECT_ALL_SLOT = new Fr(2)

export const getAuthRegistryAddress = () => AztecAddress.fromNumber(CANONICAL_AUTH_REGISTRY_ADDRESS)

export const getSetAuthorizedFn = () =>
	({
		name: "set_authorized",
		functionType: FunctionType.PUBLIC,
		isOnlySelf: false,
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
	}) as FunctionAbi

export const getSetAuthorizedSelector = async () => {
	const fn = getSetAuthorizedFn()
	return await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters)
}

export const isAuthwitConsumable = async (node: AztecNode, account: string, message_hash: string) => {
	const slot = await deriveStorageSlotInMap(
		await deriveStorageSlotInMap(APPROVED_ACTIONS_SLOT, AztecAddress.fromString(account)),
		Fr.fromString(message_hash),
	)
	const approved = await node.getPublicStorageAt("latest", getAuthRegistryAddress(), slot)
	return !approved.isZero()
}

export const isAuthRegistryEnabled = async (node: AztecNode, account: string) => {
	const slot = await deriveStorageSlotInMap(REJECT_ALL_SLOT, AztecAddress.fromString(account))
	const rejectAll = await node.getPublicStorageAt("latest", getAuthRegistryAddress(), slot)
	return rejectAll.isZero()
}
