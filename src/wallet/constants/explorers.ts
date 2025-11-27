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
 * Base URLs for each explorer by chain ID.
 * To add a new explorer: add its ID to BlockExplorerType,
 * add to BLOCK_EXPLORERS array, and add URLs here.
 */
const EXPLORER_BASE_URLS: Record<BlockExplorerType, Record<number, string>> = {
	aztecscan: {
		[CHAIN_IDS.SEPOLIA_TESTNET]: "https://testnet.aztecscan.xyz",
		[CHAIN_IDS.DEVNET]: "https://devnet.aztecscan.xyz",
	},
	none: {},
}

/**
 * Construct a transaction explorer URL for a given transaction hash.
 * Returns null if explorer is "none" or doesn't support the network.
 *
 * @param chainId - The network's chain ID
 * @param explorerId - User's selected explorer ID
 * @param txHash - Transaction hash
 * @returns Full URL to view the transaction, or null if unavailable
 */
export function getTransactionExplorerUrl(
	chainId: number,
	explorerId: BlockExplorerType | undefined,
	txHash: string
): string | null {
	if (!explorerId || explorerId === "none") return null

	const baseUrl = EXPLORER_BASE_URLS[explorerId]?.[chainId]
	return baseUrl ? `${baseUrl}/tx-effects/${txHash}` : null
}
