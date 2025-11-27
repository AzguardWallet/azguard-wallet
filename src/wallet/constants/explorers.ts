export type BlockExplorerType = "aztecscan" | "none"

export type BlockExplorer = {
	/** Unique identifier */
	id: BlockExplorerType
	/** Display name */
	name: string
}

/**
 * Known Aztec network chain IDs
 */
export const CHAIN_IDS = {
	SEPOLIA_TESTNET: 11155111,
	DEVNET: 1674512022,
	SANDBOX: 31337,
} as const

/**
 * Available block explorers for selection in settings.
 * "none" provides explicit option to disable explorer links.
 */
export const BLOCK_EXPLORERS: BlockExplorer[] = [
	{
		id: "aztecscan",
		name: "Aztecscan",
	},
	{
		id: "none",
		name: "None",
	},
]

/**
 * Generate explorer URLs based on chain ID and explorer type.
 * Returns array of explorer URLs to be stored in Network.explorerUrls
 */
export function generateExplorerUrls(chainId: number, explorerType: BlockExplorerType): string[] {
	if (explorerType === "none") {
		return []
	}

	if (explorerType === "aztecscan") {
		switch (chainId) {
			case CHAIN_IDS.SEPOLIA_TESTNET:
				return ["https://testnet.aztecscan.xyz"]
			case CHAIN_IDS.DEVNET:
				return ["https://devnet.aztecscan.xyz"]
			case CHAIN_IDS.SANDBOX:
				return []
			default:
				return []
		}
	}

	return []
}

/**
 * Get available block explorers for a specific network chainId.
 * Filters explorers based on whether they actually generate URLs for this network.
 * Does not include "none" - use getSelectableExplorers for dropdown options.
 *
 * @param chainId - The network's chain ID
 * @returns Array of available explorers (empty array if no explorers support this chain)
 */
export function getAvailableExplorers(chainId: number): BlockExplorer[] {
	return BLOCK_EXPLORERS.filter(explorer => {
		if (explorer.id === "none") return false
		const urls = generateExplorerUrls(chainId, explorer.id)
		return urls.length > 0
	})
}

/**
 * Get selectable explorers for dropdown UI.
 * Returns real explorers + "None" option when at least one real explorer is available.
 * Returns empty array if no explorers support this network (selector should be hidden).
 *
 * @param chainId - The network's chain ID
 * @returns Array of selectable explorers including "None" option
 */
export function getSelectableExplorers(chainId: number): BlockExplorer[] {
	const available = getAvailableExplorers(chainId)
	if (available.length === 0) return []

	const noneOption = BLOCK_EXPLORERS.find(e => e.id === "none")
	return noneOption ? [...available, noneOption] : available
}

/**
 * Get the user's selected explorer ID or default to first available explorer for the chainId.
 * Returns "none" if no explorers are available.
 *
 * @param chainId - The network's chain ID
 * @param selectedExplorerId - User's selected explorer (optional)
 * @returns The explorer ID to use
 */
export function getEffectiveExplorerId(chainId: number, selectedExplorerId?: BlockExplorerType): BlockExplorerType {
	// If user explicitly selected "none", respect that choice
	if (selectedExplorerId === "none") {
		return "none"
	}

	const available = getAvailableExplorers(chainId)

	// If user has a selection and it's available, use it
	if (selectedExplorerId && available.some(e => e.id === selectedExplorerId)) {
		return selectedExplorerId
	}

	// Otherwise use first available, or "none" if no explorers
	return available[0]?.id || "none"
}

/**
 * Construct a transaction explorer URL for a given transaction hash.
 * Returns null if no explorer is available for this network.
 *
 * @param chainId - The network's chain ID
 * @param selectedExplorerId - User's selected explorer ID (optional)
 * @param txHash - Transaction hash
 * @returns Full URL to view the transaction, or null if no explorer available
 */
export function getTransactionExplorerUrl(chainId: number, selectedExplorerId: BlockExplorerType | undefined, txHash: string): string | null {
	const effectiveId = getEffectiveExplorerId(chainId, selectedExplorerId)

	if (effectiveId === "none") {
		return null
	}

	const urls = generateExplorerUrls(chainId, effectiveId)
	if (urls.length === 0) {
		return null
	}

	return `${urls[0]}/tx-effects/${txHash}`
}
