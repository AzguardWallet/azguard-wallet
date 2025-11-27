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
 * Construct a transaction explorer URL for a given transaction hash.
 * Returns null if explorer is "none" or doesn't support the network.
 *
 * @param chainId - The network's chain ID
 * @param selectedExplorerId - User's selected explorer ID
 * @param txHash - Transaction hash
 * @returns Full URL to view the transaction, or null if unavailable
 */
export function getTransactionExplorerUrl(chainId: number, selectedExplorerId: BlockExplorerType | undefined, txHash: string): string | null {
	if (!selectedExplorerId || selectedExplorerId === "none") {
		return null
	}

	const urls = generateExplorerUrls(chainId, selectedExplorerId)
	if (urls.length === 0) {
		return null
	}

	return `${urls[0]}/tx-effects/${txHash}`
}
