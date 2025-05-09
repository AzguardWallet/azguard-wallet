export function getChainPosition(chainId) {
	switch (chainId) {
		case 11155111:
			return 1
		case 1337:
			return 2
		case 31337:
			return 3
		default:
			return 4
	}
}

export function getChainColor(chainId) {
	switch (chainId) {
		case 11155111:
			return "neutral-mint"
		case 1337:
			return "blue"
		case 31337:
			return "sand"
		default:
			return "purple"
	}
}

export function getChainName(chainId) {
	switch (chainId) {
		case 11155111:
			return "Testnet"
		case 1337:
			return "Devnet"
		case 31337:
			return "Sandbox"
		default:
			return `Aztec:${chainId}`
	}
}
