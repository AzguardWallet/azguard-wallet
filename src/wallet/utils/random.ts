export const getRandomHex = (length: number): string => {
	return Buffer.from(self.crypto.getRandomValues(new Uint8Array(length / 2)).buffer).toString("hex")
}

export const getRandomElement = <T>(arr: T[]): T | undefined => {
	if (!arr.length) return undefined

	const index = Math.floor(Math.random() * arr.length)

	return arr[index]
}
