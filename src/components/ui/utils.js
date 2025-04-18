export function getNetworkColor(chainId) {
    switch (chainId) {
		case 1337:
			return 'gray'
		case 31337:
			return 'sand'
		case 41337:
			return 'blue'
		case 11155111:
			return 'green'
		default:
			return 'purple'
	}
}

export function getNetworkType(chainId) {
    switch (chainId) {
		case 1337:
			return 'Devnet'
		case 31337:
			return 'Sandbox'
		case 41337:
			return 'AzguardBox'
		case 11155111:
			return 'Testnet'
		default:
			return `Aztec:${chainId}`
	}
}
