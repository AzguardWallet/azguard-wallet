import { Fr } from "@aztec/foundation/curves/bn254"
import type { PasskeyCredentialData } from "./spec"

const te = new TextEncoder()

// SECURITY: These labels are domain separators in the key derivation chain.
// Changing them produces different keys, making existing wallets inaccessible.
// They must remain "azguard:*" regardless of branding changes.
const PASSKEY_KDF_LABEL = te.encode("azguard:kdf:v1")
const PASSKEY_MASTER_LABEL = te.encode("azguard:master:v1")

export class PasskeyCredential {
	public readonly id: string
	public readonly userHandle?: string
	private baseKey: CryptoKey
	private salt: ArrayBuffer

	private constructor(id: string, baseKey: CryptoKey, salt: ArrayBuffer, userHandle?: string) {
		this.id = id
		this.userHandle = userHandle
		this.baseKey = baseKey
		this.salt = salt
	}

	public static async create(params: PasskeyCredentialData): Promise<PasskeyCredential> {
		const ikm = Buffer.from(params.prf, "base64")
		const credential = Buffer.from(params.id, "base64")
		const saltInput = Buffer.concat([PASSKEY_KDF_LABEL, credential])
		const baseKey = await self.crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"])
		const salt = await self.crypto.subtle.digest("SHA-256", saltInput)
		return new PasskeyCredential(params.id, baseKey, salt, params.userHandle)
	}

	public async deriveMasterSecret(): Promise<Buffer<ArrayBuffer>> {
		const masterBits = await self.crypto.subtle.deriveBits(
			{ name: "HKDF", hash: "SHA-256", salt: this.salt, info: PASSKEY_MASTER_LABEL },
			this.baseKey,
			256,
		)
		const masterFr = Fr.fromBufferReduce(Buffer.from(new Uint8Array(masterBits)))
		return masterFr.toBuffer() as Buffer<ArrayBuffer>
	}
}
