export type BlockExplorerType = "aztecscan" | "none"

export type BlockExplorer = {
	/** Unique identifier */
	id: BlockExplorerType
	/** Display name */
	name: string
	/** Whether this explorer is available */
	enabled: boolean
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
 * Available block explorers for selection in network settings
 * Note: "none" is not included here - it's only used internally when no explorer is available
 */
export const BLOCK_EXPLORERS: BlockExplorer[] = [
	{
		id: "aztecscan",
		name: "Aztecscan",
		enabled: true,
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
 *
 * @param chainId - The network's chain ID
 * @returns Array of available explorers (empty array if no explorers support this chain)
 */
export function getAvailableExplorers(chainId: number): BlockExplorer[] {
	return BLOCK_EXPLORERS.filter(explorer => {
		const urls = generateExplorerUrls(chainId, explorer.id)
		return urls.length > 0
	})
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
