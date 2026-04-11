// copied from @aztec/foundation/json-rpc
export function jsonStringify(obj: unknown): string {
	return JSON.stringify(obj, (_key, value) => {
		if (typeof value === "bigint") {
			return value.toString()
		} else if (typeof value === "object" && value && value.type === "Buffer" && Array.isArray(value.data)) {
			return Buffer.from(value.data).toString("base64")
		} else if (typeof value === "object" && value && Buffer.isBuffer(value)) {
			return value.toString("base64")
		} else if (typeof value === "object" && value instanceof Map) {
			return Array.from(value.entries())
		} else if (typeof value === "object" && value instanceof Set) {
			return Array.from(value.values())
		} else {
			return value
		}
	})
}

export function jsonSanitize<T>(obj: T): T {
	return (obj !== undefined ? JSON.parse(jsonStringify(obj)) : undefined) as T
}
