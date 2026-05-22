export const colors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

/**
 * Known Aztec network chain IDs.
 * Computed as: l1ChainId ^ rollupVersion
 */
export const CHAIN_IDS = {
	ALPHANET: 2934756904,  // 1 ^ 2934756905
	TESTNET: 4138294185,  // 11155111 ^ 4127419662
	DEVNET: 604129785,    // 11155111 ^ 615022430
	SANDBOX: 0,           // localhost:8080
} as const

export function isTestnet(chainId: number): boolean {
	return chainId !== CHAIN_IDS.ALPHANET
}

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
		case CHAIN_IDS.ALPHANET:
			return 0
		case CHAIN_IDS.TESTNET:
			return 2
		case CHAIN_IDS.DEVNET:
			return 3
		case CHAIN_IDS.SANDBOX:
			return 4
		default:
			return 5
	}
}

export function getChainColor(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.ALPHANET:
			return "purple"
		case CHAIN_IDS.TESTNET:
			return "neutral-mint"
		case CHAIN_IDS.DEVNET:
			return "blue"
		case CHAIN_IDS.SANDBOX:
			return "sand"
		default:
			return "gray"
	}
}

export function getChainName(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.ALPHANET:
			return "Alphanet"
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
