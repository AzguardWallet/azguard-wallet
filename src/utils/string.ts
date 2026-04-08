export const capitalize = (s: string): string => {
	if (!s) return ""
	return s.charAt(0).toUpperCase() + s.slice(1)
}

export const trimAddress = (address: string, start = 8, end = 4): string => {
	if (!address || address.length <= start + end) return address
	return `${address.substring(0, start)}..${address.substring(address.length - end)}`
}

export function isValidHex(hex: string, length = 64): boolean {
	const regex = new RegExp(`^0x[a-fA-F0-9]{${length}}$`)
	return regex.test(hex)
}

export function sanitizeString(s: string, length = 0): string {
	if (!s) return ""

	let cleaned = s.replace(/[^\p{L}0-9 \-._]/gu, "")
	if (length && cleaned.length > length) {
		cleaned = cleaned.slice(0, length)
	}

	return cleaned
}

export function stringCompare(a: string, b: string): number {
	return (a || "").localeCompare(b || "", undefined, { sensitivity: "base", numeric: true })
}
