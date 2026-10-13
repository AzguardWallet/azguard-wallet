export const colors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

/**
 * Known Aztec network chain IDs.
 * Computed as: l1ChainId ^ rollupVersion
 */
// TODO: `v6-network` add the v6 mainnet chain id once it is public.
export const CHAIN_IDS = {
	TESTNET: 3415328944,  // 11155111 ^ 3409706519
	SANDBOX: 0,           // localhost:8080
} as const

// TODO: `v6-network` match the v6 mainnet chain id. Until one exists, no chain is mainnet.
export function isMainnet(chainId: number): boolean {
	return false
}

export function isTestnet(chainId: number): boolean {
	return !isMainnet(chainId)
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
		case CHAIN_IDS.TESTNET:
			return 2
		case CHAIN_IDS.SANDBOX:
			return 4
		default:
			return 5
	}
}

export function getChainColor(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.TESTNET:
			return "neutral-mint"
		case CHAIN_IDS.SANDBOX:
			return "sand"
		default:
			return "gray"
	}
}

export function getChainName(chainId: number): string {
	switch (chainId) {
		case CHAIN_IDS.TESTNET:
			return "Testnet"
		case CHAIN_IDS.SANDBOX:
			return "Sandbox"
		default:
			return `Aztec:${chainId}`
	}
}
