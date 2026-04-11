import { CHAIN_IDS } from "@/components/ui/utils"

export type BlockExplorerType = "aztecscan"

export type BlockExplorer = {
	/** Unique identifier */
	id: BlockExplorerType
	/** Display name */
	name: string
}

/**
 * Available block explorers for selection in settings.
 * Use `null` in config to disable explorer links.
 */
export const BLOCK_EXPLORERS: BlockExplorer[] = [
	{
		id: "aztecscan",
		name: "Aztecscan",
	},
]

/**
 * Base URLs for each explorer by chain ID.
 * To add a new explorer: add its ID to BlockExplorerType,
 * add to BLOCK_EXPLORERS array, and add URLs here.
 */
const EXPLORER_BASE_URLS: Record<BlockExplorerType, Record<number, string>> = {
	aztecscan: {
		[CHAIN_IDS.MAINNET]: "https://aztecscan.xyz",
		[CHAIN_IDS.TESTNET]: "https://testnet.aztecscan.xyz",
		[CHAIN_IDS.DEVNET]: "https://devnet.aztecscan.xyz",
	},
}

/**
 * Construct a transaction explorer URL for a given transaction hash.
 * Returns null if explorer is disabled (null) or doesn't support the network.
 *
 * @param chainId - The network's chain ID
 * @param explorerId - User's selected explorer ID, or null if disabled
 * @param txHash - Transaction hash
 * @returns Full URL to view the transaction, or null if unavailable
 */
export function getTransactionExplorerUrl(
	chainId: number,
	explorerId: BlockExplorerType | null | undefined,
	txHash: string,
): string | null {
	if (!explorerId) return null

	const baseUrl = EXPLORER_BASE_URLS[explorerId]?.[chainId]
	return baseUrl ? `${baseUrl}/tx-effects/${txHash}` : null
}
