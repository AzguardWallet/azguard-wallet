export const isPrefersDarkScheme = () => {
	return window.matchMedia("(prefers-color-scheme: dark)")?.matches
}

const CAIP_PREFIX = "aztec"
export const CAIP = {
    chain(chainId) {
        return `${CAIP_PREFIX}:${chainId}`
    },
    address(chainId, address) {
        return `${CAIP_PREFIX}:${chainId}:${address}`
    },
}

export const AZTEC_METHODS = ["aztec_execute"]
export const AZTEC_EVENTS = ["accountsChanged"]
