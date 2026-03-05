# Phase 1: Key Management & Cryptography Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 1 CRITICAL, 4 HIGH, 6 MEDIUM, 3 INFO

---

## CRITICAL FINDINGS

### F-P1-01: CRITICAL — Single SHA-256 Password Hashing (No Salt, No KDF)

**File:** `src/wallet/services/profile/encryption/encryption-key.ts:94-96`
```typescript
public static async getPasshash(password: string): Promise<ArrayBuffer> {
    const utf8 = new TextEncoder();
    return await self.crypto.subtle.digest("SHA-256", utf8.encode(password));
}
```

**Issue:** Password is hashed using a single pass of SHA-256 with no salt and no iterations. SHA-256 runs at ~1 billion hashes/sec on GPU, making brute-force trivial for typical passwords.

**Impact:** An attacker who obtains the session storage (see F-P1-03) gets a fast-crackable password hash. Combined with the session restore mechanism, this is the most critical vulnerability in the wallet.

**Fix:** Replace with PBKDF2 (already available in the codebase at 600k iterations) or Argon2. Include a per-profile random salt stored alongside the profile.

---

## HIGH FINDINGS

### F-P1-02: HIGH — IV-to-Salt Derivation in EncryptionKey

**File:** `src/wallet/services/profile/encryption/encryption-key.ts:31-44`
```typescript
const iv = self.crypto.getRandomValues(new Uint8Array(12));
const salt = await self.crypto.subtle.digest("SHA-256", iv);  // salt = SHA-256(IV)
const key = await this.deriveKey(salt);  // PBKDF2 with 600k iterations
```

**Issue:** Salt is deterministically derived from IV via SHA-256. While each encryption gets a fresh random IV (making this safe in practice), the design couples two values that should be independently random. Additionally, PBKDF2 (600k iterations) is called on every encrypt/decrypt operation, which is inefficient.

**Fix:** Use an independently random salt. Store it alongside the ciphertext. Optionally, cache the derived key for the session duration instead of re-deriving per operation.

---

### F-P1-03: HIGH — PRF Output Not Validated in Passkey Credential

**File:** `src/wallet/services/passkey/credential.ts:22-28`
```typescript
public static async create(params: PasskeyCredentialData): Promise<PasskeyCredential> {
    const ikm = Buffer.from(params.prf, "base64");  // No length/type validation
    const credential = Buffer.from(params.id, "base64");
    // ...
}
```

**Issue:** The PRF output from WebAuthn is decoded and used as HKDF input without validating minimum length (should be >= 32 bytes), non-zero content, or buffer validity. A malicious or buggy passkey response could provide weak IKM.

**Fix:** Add validation: `if (ikm.length < 32) throw new Error("PRF output too short");`

---

### F-P1-04: HIGH — Passkey Window Race Condition & Leak

**File:** `src/wallet/services/passkey/service.ts:50-89`

**Issue:** The `openWindowAndWait()` method creates a popup and registers a close handler in the callback. Between window creation and handler registration, the window could close, leaving a dangling promise that never resolves. Additionally, there's no timeout on pending requests — stale entries accumulate in the `pending` map.

**Fix:** Register the close handler synchronously before creating the window, and add a 60-second timeout that auto-rejects the promise.

---

### F-P1-05: HIGH — Math.random() in getRandomElement()

**File:** `src/wallet/utils/random.ts:5-10`
```typescript
export const getRandomElement = (arr: any[]) => {
    const index = Math.floor(Math.random() * arr.length)
    return arr[index]
}
```

**Issue:** Uses `Math.random()` (non-cryptographic PRNG) for element selection. If used for security-sensitive selections (choosing keys, endpoints, etc.), the result is predictable.

**Note:** `getRandomHex()` in the same file correctly uses `crypto.getRandomValues()`. This function is the exception.

**Fix:** Replace with `crypto.getRandomValues()` for the index calculation.

---

## MEDIUM FINDINGS

### F-P1-06: MEDIUM — Passhash Stored in Session Storage

**File:** `src/wallet/services/profile/service.ts:567-571`
```typescript
const session: Session = {
    profile: profileId,
    passhash: passhash ? Buffer.from(passhash).toString("base64") : undefined,
    since: Date.now(),
};
await this.session.set(session);
```

**Issue:** The passhash (SHA-256 of password) is base64-encoded and stored in `chrome.storage.session`. Combined with F-P1-01 (weak hash), this provides a fast-crackable password if session storage is compromised.

**Fix:** Don't store the passhash. Re-derive on each operation, or store only a derived session token that can't be used to recover the password.

---

### F-P1-07: MEDIUM — Session Restore Bypasses Password Entry

**File:** `src/wallet/services/profile/service.ts:531-558`
```typescript
private async restorePasswordSession(session: Session, profile: Profile) {
    if (!session.passhash) { /*...*/ }
    const passhash = Buffer.from(session.passhash, "base64");
    const key = await EncryptionKey.fromPasshash(passhash.buffer);
    // Decrypts profile using stored passhash — no password re-entry
}
```

**Issue:** Session restore uses the stored passhash to decrypt the profile secret directly, without requiring the user to re-enter their password. If session storage is compromised, the attacker gets a session without the password.

**Fix:** Require password re-entry on session restore, or use shorter session TTL.

---

### F-P1-08: MEDIUM — Hardcoded ENCRYPTION_GUARD

**File:** `src/wallet/services/profile/spec.ts:5`
```typescript
export const ENCRYPTION_GUARD = new Uint8Array([6, 11, 20, 20, 22, 4, 20, 22]);
```

**Issue:** An 8-byte hardcoded constant used for password verification. Decryption of this guard with the candidate key is how password correctness is determined. The guard is known to any attacker who reads the source code.

**Impact:** Low additional risk since AES-GCM already provides authentication (wrong key → decryption error), but the guard pattern is unnecessary complexity.

---

### F-P1-09: MEDIUM — Account Secret Derivation Lacks Explicit Domain Separation

**File:** `src/wallet/services/account/service.ts:148`
```typescript
return poseidon2Hash([master, chainId, type, index]);
```

**Issue:** No explicit version or purpose constant in the derivation inputs. If the derivation scheme changes, there's no domain separator to prevent cross-context collisions. Poseidon2 may include internal domain separation, but this is not explicitly verified.

**Fix:** Add a version constant: `poseidon2Hash([master, DERIVATION_VERSION, chainId, type, index])`

---

### F-P1-10: MEDIUM — Account Secret Sent to PXE

**File:** `src/wallet/services/account/contracts/azguard-v0-base.ts:67`
```typescript
await pxe.registerAccount(this.secret, await computePartialAddress(this.instance));
```

**Issue:** The raw account secret crosses the background→offscreen boundary. The offscreen PXE stores it in IndexedDB. This expands the attack surface — if the offscreen document is compromised, all registered account secrets are exposed.

**Impact:** This is architecturally necessary (PXE needs the secret for private execution). Documented as an accepted trust boundary.

---

### F-P1-11: MEDIUM — Session TTL Can Be Disabled

**File:** `src/wallet/services/profile/service.ts:57`
```typescript
if (session.since + this.sessionTtl <= Date.now() && this.sessionTtl !== 0) {
```

**Issue:** Setting `sessionTtl = 0` disables session expiration entirely. No validation prevents this configuration.

**Fix:** Enforce a minimum TTL (e.g., 60 seconds).

---

## INFORMATIONAL

### F-P1-12: INFO — ECDH Public Key Empty keyUsages (Browser Workaround)

**File:** `src/content-script/proxy/messenger/utils.ts:35`
```typescript
true,  // extractable
[],    // empty keyUsages — browser bug workaround
```

Documented browser compatibility issue. Empty keyUsages on public keys is safe but unusual.

### F-P1-13: INFO — No Explicit Memory Zeroing (JS Limitation)

**File:** `src/wallet/services/profile/service.ts:511`
```typescript
this.activeSession = undefined;  // GC clears memory eventually
```

JavaScript provides no mechanism to securely zero memory. `Fr`, `Buffer`, and `GrumpkinScalar` objects persist in heap until garbage collected. Acknowledged limitation.

### F-P1-14: INFO — Magic Constant 257 in Signing Key Derivation

**File:** `src/wallet/services/account/contracts/azguard-v0.ts:23`
```typescript
const signingKey = sha512ToGrumpkinScalar([secret, 257]);
```

The purpose of `257` is unclear — should be a named constant (`SIGNING_KEY_DERIVATION_INDEX`).

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| `getRandomHex()` | Uses `crypto.getRandomValues()` — correct |
| AES-256-GCM usage | Correct IV size, random per encryption, authenticated |
| ECDH P-521 | Strong curve choice, proper key agreement |
| Schnorr signatures | Standard implementation via Aztec SDK |
| PBKDF2 iterations | 600,000 iterations when used — meets NIST recommendations |
| Passkey PRF not stored | Re-derived on each unlock — strongest secret lifecycle |
| HKDF for passkey derivation | Proper extract-then-expand with labeled salt and info |
