export const array_equals = (arr1: Uint8Array<ArrayBuffer>, arr2: Uint8Array<ArrayBuffer>): boolean => {
	if (arr1.length !== arr2.length) {
		return false
	}
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) {
			return false
		}
	}
	return true
}

export const array_max = (arr: Array<number>): number => {
	let res = 0
	for (const x of arr) {
		if (x > res) {
			res = x
		}
	}
	return res
}

function safeStringify(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return "undefined"
	if (typeof value === "string") return value
	if (typeof value === "bigint") {
		return value.toString()
	}
	if (value instanceof Date) return value.toISOString()
	if (typeof value === "object" && !Array.isArray(value)) {
		try {
			return JSON.stringify(value, Object.keys(value).sort())
		} catch {
			return "[Unserializable Object]"
		}
	}
	return String(value)
}

export function hasIntersectionByKeys<T extends Record<string, unknown>>(arr1: T[], arr2: T[], keys: (keyof T)[]): boolean {
	const keySet = new Set<string>()

	arr1.forEach((item) => {
		const key = keys.map((k) => safeStringify(item[k])).join("|")
		keySet.add(key)
	})

	return arr2.some((item) => {
		const key = keys.map((k) => safeStringify(item[k])).join("|")
		return keySet.has(key)
	})
}
