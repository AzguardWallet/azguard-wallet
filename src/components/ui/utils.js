export function getNetworkColor(chainId) {
    switch (chainId) {
		case 1337:
			return 'gray'
		case 31337:
			return 'sand'
		case 41337:
			return 'blue'
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
		default:
			return `Aztec:${chainId}`
	}
}
