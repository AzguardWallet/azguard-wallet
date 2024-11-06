/**
 * Provides functionality for password-based encryption and decryption.
 * Primarily used for encrypting secrets to be stored in the local storage.
 */
export class EncryptionKey {
    private constructor(private baseKey: CryptoKey) {}

    private deriveKey(salt: ArrayBuffer): Promise<CryptoKey> {
        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: 600_000,
                hash: "SHA-256",
            },
            this.baseKey,
            {
                name: "AES-GCM",
                length: 256,
            },
            false,
            ["encrypt", "decrypt"],
        );
    }

    /**
     * Encrypts payload
     * @param payload - Bytes to be encrypted
     * @returns Encrypted bytes
     */
    public async encrypt(payload: Uint8Array): Promise<Uint8Array> {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const salt = await window.crypto.subtle.digest("SHA-256", iv);
        const key = await this.deriveKey(salt);
        const buffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);
        
        const ct = new Uint8Array(buffer);
        const result = new Uint8Array(13 + ct.length);
        result.set([0], 0); // 1 byte version tag
        result.set(iv, 1);  // 12 bytes initialization vector
        result.set(ct, 13); // ciphertext
        
        return result;
    };

    /**
     * Decrypts payload
     * @param payload - Bytes to be decrypted
     * @returns Decrypted bytes
     */
    public async decrypt(payload: Uint8Array): Promise<Uint8Array> {
        if (payload.length < 13) {
            throw new Error('Invalid payload length');
        }
        if (payload[0] !== 0) { // version tag
            throw new Error('Invalid payload format');
        }
        const iv = payload.subarray(1, 13);
        const ct = payload.subarray(13, payload.length);

        const salt = await window.crypto.subtle.digest("SHA-256", iv);
        const key = await this.deriveKey(salt);
        const buffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
        
        return new Uint8Array(buffer);
    }

    /**
     * Creates EncryptionKey from user password
     * @param password - User password
     * @returns New instance of EncryptionKey
     */
    public static async fromPassword(password: string): Promise<EncryptionKey> {
        const passhash = await this.getPasshash(password);
        return this.fromPasshash(passhash);
    }
    
    /**
     * Creates EncryptionKey from user password hash
     * @param passhash - Hash of the password
     * @returns New instance of EncryptionKey
     */
    public static async fromPasshash(passhash: ArrayBuffer): Promise<EncryptionKey> {
        const baseKey = await window.crypto.subtle.importKey("raw", passhash, "PBKDF2", false, ["deriveKey"]);
        return new EncryptionKey(baseKey);
    }
    
    /**
     * Calculates password hash
     * @param password User password
     * @returns Hash of the password
     */
    public static async getPasshash(password: string): Promise<ArrayBuffer> {
        const utf8 = new TextEncoder();
        return await window.crypto.subtle.digest("SHA-256", utf8.encode(password));
    }
}
