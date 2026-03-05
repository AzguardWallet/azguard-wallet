# Phase 1 — Key Management & Cryptography

## F-P1-01: SHA-256 Pre-Hash Before PBKDF2 (LOW)

**File:** `src/wallet/services/profile/encryption/encryption-key.ts:94-96`

The plaintext password is hashed with SHA-256 before being used as input keying material for PBKDF2:

```typescript
const utf8 = new TextEncoder();
return await self.crypto.subtle.digest("SHA-256", utf8.encode(password));
```

This pre-hash feeds into PBKDF2-SHA256 with 600,000 iterations (line 13). The pre-hash truncates password entropy to 256 bits — acceptable for most passwords but eliminates any benefit of passphrases longer than ~256 bits of entropy.

**Impact:** Low. 600k PBKDF2 iterations meet OWASP 2023 minimums (310k). The pre-hash is a minor weakness, not exploitable in practice.

**Recommendation:** Consider removing the SHA-256 pre-hash and importing the raw password directly via `crypto.subtle.importKey("raw", utf8.encode(password), "PBKDF2", ...)`. Alternatively, migrate to Argon2id for hardware-attack resistance.

---

## F-P1-02: IV/Salt Deterministic Coupling (LOW)

**File:** `src/wallet/services/profile/encryption/encryption-key.ts:32-33`

```typescript
const iv = self.crypto.getRandomValues(new Uint8Array(12));
const salt = await self.crypto.subtle.digest("SHA-256", iv);
```

The PBKDF2 salt is derived deterministically from the AES-GCM IV. While collision probability is negligible (2^-96 for 12-byte random IVs), this creates a non-standard dependency: identical IVs produce identical salts and thus identical derived keys.

**Impact:** Low. `crypto.getRandomValues` provides sufficient randomness. The coupling is unconventional but not exploitable.

**Recommendation:** Use an independent 16-byte random salt for PBKDF2 to follow standard practice. Store salt alongside IV in the ciphertext envelope.

---

## F-P1-03: Math.random() for Request IDs (HIGH)

**Files:**
- `src/wallet/base/background/client.ts:138-144`
- `src/wallet/base/offscreen/client.ts:133-139`

```typescript
private getRequestId() {
    let id;
    do {
        id = 1 + Math.random();
    } while (this.requests.has(id));
    return id;
}
```

`Math.random()` is not cryptographically secure. Request IDs correlate responses to requests across the chrome.runtime message bus. An attacker who can observe message traffic (e.g., via a compromised content script or extension) could predict future IDs.

**Impact:** High. Request ID prediction could allow response spoofing between popup↔background or background↔offscreen channels.

**Recommendation:** Replace with `crypto.getRandomValues`:
```typescript
private getRequestId() {
    return crypto.getRandomValues(new Uint32Array(1))[0];
}
```

---

## F-P1-04: Passkey PRF Key Derivation (INFO)

**File:** `src/wallet/services/passkey/credential.ts:6-39`

HKDF-SHA256 derivation from WebAuthn PRF output is correctly implemented:
- Input keying material: PRF extension output (base64)
- Salt: SHA-256(label || credential_id)
- Info: domain-separated label `azguard:master:v1`
- Output: 256-bit Fr field element

No issues found.

---

## F-P1-05: Account Key Derivation (INFO)

**File:** `src/wallet/services/account/service.ts:143-148`

```typescript
return poseidon2Hash([master, chainId, type, index]);
```

Deterministic account derivation via Poseidon2 hash follows Aztec ecosystem conventions. Signing keys use `sha512ToGrumpkinScalar` (Schnorr-compatible). No cryptographic weaknesses identified.

---

## F-P1-06: No Hardcoded Secrets (INFO)

No hardcoded mnemonics, private keys, API keys, or test credentials found in production code. BIP39 word list in `src/wallet/utils/mnemonic.ts` is standard and non-sensitive. Test files use dummy passwords (`"qwerty"`, `"qwe"`) which is expected.
