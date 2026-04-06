export const colors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

/**
 * Known Aztec network chain IDs.
 * Computed as: l1ChainId ^ rollupVersion
 */
export const CHAIN_IDS = {
	MAINNET: 2934756904,  // (1 ^ 2934756905) >>> 0 — Alpha mainnet
	TESTNET: 4138294185,  // (11155111 ^ 4127419662) >>> 0
	DEVNET: 896946031,    // (11155111 ^ 903641544) >>> 0 — v4-devnet-3
	SANDBOX: 0,           // localhost:8080
} as const

export function getColorFromAddress(address: string): string {
	if (!address) return colors[0]

	const clean = address.startsWith("0x") ? address.slice(2) : address
	let hash = 0
	for (let i = 0; i < clean.length; i++) {
		hash = (hash + clean.charCodeAt(i)) % 2147483647
	}

	const index = hash % colors.length

	return colors[index]
}

export function getChainPosition(chainId: number): number {
	switch (chainId) {
		case CHAIN_IDS.MAINNET:
			return 0
		case CHAIN_IDS.TESTNET:
			return 1
		case CHAIN_IDS.DEVNET:
			return 2
		case CHAIN_IDS.SANDBOX:
			return 3
		default:
			return 4
	}
}

export function getChainColor(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.MAINNET:
			return "green"
		case CHAIN_IDS.TESTNET:
			return "neutral-mint"
		case CHAIN_IDS.DEVNET:
			return "blue"
		case CHAIN_IDS.SANDBOX:
			return "sand"
		default:
			return "purple"
	}
}

export function getChainName(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.MAINNET:
			return "Alpha"
		case CHAIN_IDS.TESTNET:
			return "Testnet"
		case CHAIN_IDS.DEVNET:
			return "Devnet"
		case CHAIN_IDS.SANDBOX:
			return "Sandbox"
		default:
			return `Aztec:${chainId}`
	}
}
