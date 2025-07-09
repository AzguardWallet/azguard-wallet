export const getRandomHex = (length: number): string => {
    return Buffer.from(self.crypto.getRandomValues(new Uint8Array(length / 2)).buffer).toString('hex');
}
