export const getRandomHex = (length: number): string => {
    return Buffer.from(window.crypto.getRandomValues(new Uint8Array(length / 2)).buffer).toString('hex');
}
