/**
 * Maps wallet-sdk method names to required capability types.
 *
 * Used by `enforceCapability()` in the dispatcher to check whether a dApp
 * has been granted the capability needed for a given method call.
 *
 * Exempt methods (getChainInfo, requestCapabilities, batch) do not require
 * any capability grant — they are either meta-protocol or infrastructure.
 */

export type CapabilityType = "accounts" | "contracts" | "contractClasses" | "simulation" | "transaction" | "data"

/** Methods that never require a capability check. */
const EXEMPT_METHODS = new Set(["getChainInfo", "requestCapabilities", "batch", "getAccounts"])

/** Maps each wallet-sdk method name to its required capability type. */
const METHOD_CAPABILITY_MAP: Record<string, CapabilityType> = {
	// accounts
	getCompleteAddress: "accounts",
	createAuthWit: "accounts",
	registerToken: "accounts",

	// contracts
	registerContract: "contracts",
	getContractMetadata: "contracts",

	// contractClasses
	getContractClassMetadata: "contractClasses",

	// simulation
	simulateTx: "simulation",
	executeUtility: "simulation",
	profileTx: "simulation",
	simulateViews: "simulation",

	// transaction
	sendTx: "transaction",

	// data
	getPrivateEvents: "data",
	getAddressBook: "data",
	registerSender: "data",
}

/**
 * Get the capability type required for a wallet-sdk method.
 * Returns `null` for exempt or unknown methods.
 */
export function getRequiredCapability(method: string): CapabilityType | null {
	return METHOD_CAPABILITY_MAP[method] ?? null
}

/**
 * Check if a method is exempt from capability enforcement.
 */
export function isCapabilityExempt(method: string): boolean {
	return EXEMPT_METHODS.has(method)
}
