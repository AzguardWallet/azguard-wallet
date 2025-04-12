export const capitalize = (s) => {
	if (!s) return ""

	return s.charAt(0).toUpperCase() + s.slice(1)
}

export const trimAddress = (address, start = 8, end = 4) => {
	if (!address || address.length <= start + end) return address
	return `${address.substring(0, start)}..${address.substring(address.length - end)}`
}

export function isValidHex(hex, length = 64) {
	const regex = new RegExp(`^0x[a-fA-F0-9]{${length}}$`)
	return regex.test(hex)
}
