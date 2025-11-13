export const colors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

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
		case 1721521349: // 11155111 ^ 1714840162
			return 1
		case 1674512022: // 11155111 ^ 1667575857
			return 2
		case 0: // localhost:8080
			return 3
		default:
			return 4
	}
}

export function getChainColor(chainId: number): string {
	switch (chainId) {
		case 1721521349: // 11155111 ^ 1714840162
			return "neutral-mint"
		case 1674512022: // 11155111 ^ 1667575857
			return "blue"
		case 0: // localhost:8080
			return "sand"
		default:
			return "purple"
	}
}

export function getChainName(chainId: number): string {
	switch (chainId) {
		case 1721521349: // 11155111 ^ 1714840162
			return "Testnet"
		case 1674512022: // 11155111 ^ 1667575857
			return "Devnet"
		case 0: // localhost:8080
			return "Sandbox"
		default:
			return `Aztec:${chainId}`
	}
}
