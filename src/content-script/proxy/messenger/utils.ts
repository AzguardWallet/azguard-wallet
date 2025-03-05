import { jsonStringify } from "@/wallet/utils/serialization";

export const M_HANDSHAKE = "azguard-handshake";
export const M_MESSAGE = "azguard-message";

export async function generateKeyPair(): Promise<CryptoKeyPair> {
    return await window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-521",
        },
        true,
        ["deriveKey"],
    );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
    return bytesToBase64(
        await window.crypto.subtle.exportKey(
            "raw",
            publicKey
        ),
    );
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
    return await window.crypto.subtle.importKey(
        "raw",
        base64ToBytes(base64),
        {
            name: "ECDH",
            namedCurve: "P-521",
        },
        true,
        [],
        // bug:
        // https://stackoverflow.com/questions/54179887/how-to-import-ecdh-public-key-cannot-create-a-key-using-the-specified-key-usage
        // should be:
        // ["deriveKey"],
    );
}

export async function deriveEncryptionKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
    return await window.crypto.subtle.deriveKey(
      {
        name: "ECDH",
        public: publicKey,
      },
      privateKey,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      ["encrypt", "decrypt"],
    );
}

export async function encrypt<T>(payload: T, key: CryptoKey): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const pt = new TextEncoder().encode(jsonStringify(payload));
    const ct = new Uint8Array(
        await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv }, key, pt,
        ),
    );
    const buf = new Uint8Array(iv.length + ct.length);
    buf.set(iv);
    buf.set(ct, iv.length);
    return bytesToBase64(buf.buffer);
}

export async function decrypt<T>(payload: string, key: CryptoKey): Promise<T> {
    const buf = new Uint8Array(base64ToBytes(payload));
    const iv = buf.subarray(0, 12);
    const ct = buf.subarray(12, buf.length);
    return JSON.parse(new TextDecoder().decode(
        await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv }, key, ct,
        ),
    )) as T;
}

function bytesToBase64(bytes: ArrayBuffer) {
    let res = "";
    const array = new Uint8Array(bytes);
    for (let i = 0; i < array.byteLength; i++) {
        res += String.fromCharCode(array[i]);
    }
    return window.btoa(res);
}

function base64ToBytes(base64: string) {
    const ascii = window.atob(base64);
    const bytes = new ArrayBuffer(ascii.length);
    const bytesView = new Uint8Array(bytes);
    for (let i = 0; i < ascii.length; i++) {
        bytesView[i] = ascii.charCodeAt(i);
    }
    return bytes;
}