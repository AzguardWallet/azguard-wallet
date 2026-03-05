# Phase 0.2: Secret Lifecycle Map

## Overview

There are **7 distinct secrets** in the system. Each follows a lifecycle from generation through storage, usage, and (attempted) destruction.

```
User Password ──SHA-256──► Passhash ──PBKDF2+AES-GCM──► Encrypts Master Secret
                              │                              │
                              ▼                              ▼
                     Session Storage                  Local Storage
                     (chrome.session)                 (chrome.local)
                              │                              │
                              ▼                              ▼
                     Unlock: decrypt              Master Secret (Fr)
                                                         │
                                    Poseidon2(master, chainId, type, index)
                                                         │
                                                         ▼
                                                  Account Secret (Fr)
                                                         │
                                        SHA-512(secret, 257) → GrumpkinScalar
                                                         │
                                                         ▼
                                                   Signing Key
                                                         │
                                              Schnorr signature
                                                         │
                                                         ▼
                                                   AuthWitness
```

---

## Secret 1: User Password

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Birth** | UI text input | Popup component | - |
| **Hashing** | SHA-256 only | `profile/encryption/encryption-key.ts` | 94-96 |
| **Storage** | Session storage as base64 | `profile/service.ts` | 567-571 |
| **Usage** | Create EncryptionKey for decrypt | `profile/service.ts` | 92-93, 126-127 |
| **Clearing** | Session cleared on lock | `profile/service.ts` | 509-511 |

### Derivation
```
password (string)
  → TextEncoder.encode(password)
  → crypto.subtle.digest("SHA-256", encoded)
  → passhash (32-byte ArrayBuffer)
```

### Storage Format
```typescript
// Stored in chrome.storage.session at key "azguard:core:session"
{
  profile: profileId,
  passhash: Buffer.from(passhash).toString("base64"),  // base64 of SHA-256 hash
  since: Date.now()
}
```

### Findings

**[F-S1-01] CRITICAL - Single SHA-256 for Password Hashing**
- File: `src/wallet/services/profile/encryption/encryption-key.ts:94-96`
- `getPasshash()` uses a single pass of SHA-256 — no iterations, no salt
- SHA-256 is fast (~1 billion hashes/sec on GPU) making brute-force trivial
- PBKDF2 with 600k iterations is used *later* for key derivation, but the passhash itself is weak
- If session storage is dumped, attacker has a fast-crackable hash of the password
- **Recommendation:** Use PBKDF2 or Argon2 with salt for the initial password hashing step

**[F-S1-02] HIGH - Passhash in Session Storage**
- File: `src/wallet/services/profile/service.ts:567-571`
- The passhash (SHA-256 of password) is stored in `chrome.storage.session`
- Session storage is cleared when the browser closes, but accessible to all extension contexts while open
- Combined with F-S1-01, this gives an attacker a fast-crackable password hash
- **Recommendation:** Don't store the passhash; re-derive on each operation or use a derived session token

---

## Secret 2: Master Profile Secret

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Birth** | `Fr.random().toBuffer()` | `profile/service.ts` | 95 |
| **Encryption** | AES-256-GCM via PBKDF2 key | `profile/encryption/encryption-key.ts` | 31-44 |
| **Storage** | Local storage (encrypted) | `profile/service.ts` | 110 |
| **Decryption** | On profile unlock | `profile/service.ts` | 143-145 |
| **In-memory** | `this.activeSession.secret` | `profile/service.ts` | 573-574 |
| **Access** | `getProfileSecret(profileId)` | `profile/service.ts` | 479-492 |
| **Clearing** | `activeSession = undefined` | `profile/service.ts` | 511 |

### Generation
```
Fr.random()          → Aztec field element (random, from @aztec/foundation)
  .toBuffer()        → 32-byte Buffer
```
Entropy source: `@aztec/foundation` which uses `crypto.getRandomValues` internally.

### Encryption at Rest
```
passhash (32 bytes)
  → crypto.subtle.importKey("raw", passhash, "PBKDF2", false, ["deriveKey"])
  → baseKey (CryptoKey)

Random IV (12 bytes) → crypto.getRandomValues(new Uint8Array(12))
Salt = SHA-256(IV)   → 32 bytes

baseKey + salt + 600,000 iterations
  → crypto.subtle.deriveKey(PBKDF2, SHA-256)
  → AES-GCM-256 key

AES-GCM(key, IV, secret)
  → [version_tag (1 byte)][IV (12 bytes)][ciphertext]
  → base64 string → stored in profile entity
```

### Storage Format
```typescript
// Stored in chrome.storage.local at key "azguard:core:profiles@{profileId}"
{
  id: string,
  name: string,
  type: "password" | "passkey",
  secret: string,    // base64 of [version][IV][ciphertext]
  guard: string,     // base64 of encrypted ENCRYPTION_GUARD constant
  // ...
}
```

### Findings

**[F-S2-01] MEDIUM - Salt Derived from IV**
- File: `src/wallet/services/profile/encryption/encryption-key.ts:33`
- `const salt = await self.crypto.subtle.digest("SHA-256", iv)`
- Salt is deterministically derived from IV — same IV would produce same salt and same key
- In practice, IV is random 12 bytes so collision is astronomically unlikely
- But this violates the principle that salt and IV should be independently random
- **Recommendation:** Use independently random salt (store alongside ciphertext)

**[F-S2-02] INFO - No Explicit Memory Zeroing**
- File: `src/wallet/services/profile/service.ts:511`
- `this.activeSession = undefined` relies on JavaScript garbage collection
- `Fr` and `Buffer` objects containing the secret may persist in heap until GC runs
- JavaScript provides no mechanism to securely zero memory
- **Recommendation:** Acknowledged limitation of the JS runtime. Consider using `Uint8Array.fill(0)` on buffer before dereferencing as best-effort mitigation.

---

## Secret 3: Account Secrets (Derived)

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Derivation** | `poseidon2Hash([master, chainId, type, index])` | `account/service.ts` | 143-148 |
| **Usage** | Passed to `AzguardV0.new(secret)` | `account/service.ts` | 54-58, 125-126 |
| **In-memory** | `this.secret` (protected field) | `account/contracts/azguard-v0-base.ts` | 54 |
| **Clearing** | Contract instance garbage collected | - | - |

### Derivation Path
```
master (Fr, 32 bytes)
  + chainId (number)
  + type (AccountType enum)
  + index (number)
  → poseidon2Hash([master, chainId, type, index])
  → accountSecret (Fr, 32 bytes)
```

### Key Properties
- **Deterministic:** Same inputs always produce same output
- **One-way:** Cannot recover master from account secret (Poseidon2 preimage resistance)
- **Not stored:** Re-derived on demand from master secret
- **Collision resistance:** Unique per (chainId, type, index) tuple

### Findings

**[F-S3-01] INFO - Account Secret Stored as Protected Class Member**
- File: `src/wallet/services/account/contracts/azguard-v0-base.ts:54`
- `protected readonly secret: Fr` — accessible to derived classes
- Lives in memory for the lifetime of the contract instance
- No explicit clearing mechanism

---

## Secret 4: Signing Keys

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Derivation** | `sha512ToGrumpkinScalar([secret, 257])` | `account/contracts/azguard-v0.ts` | 23 |
| **Public key** | `new Schnorr().computePublicKey(signingKey)` | `account/contracts/azguard-v0.ts` | 24 |
| **Storage** | Protected field in contract instance | `account/contracts/azguard-v0-base.ts` | 55-56 |
| **Usage** | `schnorr.constructSignature(hash, signingKey)` | `account/contracts/azguard-v0-base.ts` | 83-86 |

### Derivation
```
accountSecret (Fr)
  → sha512ToGrumpkinScalar([secret, Fr(257)])
  → signingKey (GrumpkinScalar, 32 bytes)

signingKey
  → Schnorr.computePublicKey(signingKey)
  → signingPubKey (Point on Grumpkin curve)
```

### Usage in Transaction Signing
```
transaction payload
  → poseidon2HashWithSeparator(calls + nonce + fee, SIGNATURE_PAYLOAD)
  → messageHash (Fr)

messageHash + signingKey
  → schnorr.constructSignature(messageHash.toBuffer(), signingKey)
  → signature (64 bytes)

  → AuthWitness(messageHash, [...signature.toBuffer()])
```

### Findings

**[F-S4-01] INFO - Signing Key Not Re-derived Per Transaction**
- Signing key is derived once when the `AzguardV0` instance is created
- Reused for all transactions during the instance's lifetime
- This is standard practice for account-based wallets

---

## Secret 5: Passkey/PRF Secret

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **PRF generation** | WebAuthn PRF extension | Browser API | - |
| **Reception** | `PasskeyCredential.create(data)` | `passkey/credential.ts` | 22-28 |
| **Derivation** | HKDF-SHA256 from PRF output | `passkey/credential.ts` | 31-38 |
| **Usage** | Passed to `_openSession()` as master secret | `profile/service.ts` | 208-210 |
| **Clearing** | Credential object garbage collected | - | - |

### Derivation
```
WebAuthn PRF output (base64)
  → Buffer.from(prf, "base64")
  → IKM (Input Key Material)

credentialId (base64)
  → "azguard:kdf:v1" + credentialId
  → SHA-256
  → salt (32 bytes)

HKDF-SHA256(IKM, salt, info="azguard:master:v1", 256 bits)
  → Fr.fromBufferReduce(derivedBits)
  → masterSecret (Fr, 32 bytes)
```

### Key Properties
- **PRF output never stored** — re-derived on each unlock via WebAuthn
- **credentialId stored in profile** — public per WebAuthn spec
- **HKDF provides proper key derivation** — better than raw PRF output

### Findings

**[F-S5-01] GOOD - PRF Output Not Persisted**
- The PRF output is never written to storage
- Each unlock requires a fresh WebAuthn authentication
- This is the strongest secret lifecycle in the codebase

**[F-S5-02] LOW - Credential Metadata Storage**
- `credentialId` stored as part of the profile entity
- `userHandle` passed as profile ID during creation
- Both are considered public per the WebAuthn specification
- No security impact

---

## Secret 6: ECDH Session Keys (Content Script)

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Key generation** | `crypto.subtle.generateKey(ECDH, P-521)` | `messenger/utils.ts` | 6-20 |
| **Key exchange** | ECDH handshake over postMessage | `messenger/client .ts:36-45`, `server.ts:96-126` |
| **Derivation** | `crypto.subtle.deriveKey(ECDH → AES-GCM-256)` | `messenger/utils.ts` | 43-56 |
| **Storage** | Private class fields (`#key`, `#clients` Map) | `client .ts:24`, `server.ts:19` |
| **Clearing** | Page navigation (GC) | - | - |

### Key Generation
```
Client: crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-521" }, true, ["deriveKey"])
Server: crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-521" }, true, ["deriveKey"])
```

### Key Exchange
```
Client pubkey (base64) → postMessage → Server
Server imports → derives AES-256 shared secret
Server pubkey (base64) → postMessage → Client
Client imports → derives same AES-256 shared secret
```

### Encryption
```
plaintext (JSON.stringify(payload))
  + random IV (12 bytes)
  + AES-GCM key
  → AES-GCM encrypt
  → [IV (12 bytes)][ciphertext]
  → base64 string
```

### Findings

**[F-S6-01] GOOD - Strong Cryptographic Primitives**
- P-521 ECDH provides 256-bit security equivalent
- AES-256-GCM provides authenticated encryption
- Random IV per message prevents replay

**[F-S6-02] LOW - No Forward Secrecy**
- One keypair per page lifetime
- All messages decryptable with same key
- Impact: Low — key compromise requires process-level access

---

## Secret 7: dApp Session Tokens

### Lifecycle

| Stage | Location | File | Line |
|-------|----------|------|------|
| **Generation** | `getRandomHex(64)` (256 bits) | `dapp-session/service.ts` | 85-88 |
| **Storage** | Local storage (plaintext) | `dapp-session/service.ts` | 99 |
| **Validation** | On every RPC call | `dapp-session/service.ts` | 51-59 |
| **Expiry** | 7 days from creation | `dapp-session/service.ts` | 97 |
| **Deletion** | Explicit or expiry-triggered | `dapp-session/service.ts` | 158-173, 175-190 |

### Token Properties
- **Bearer token:** Anyone with the session ID can use the session
- **256-bit entropy:** Collision/guessing infeasible
- **No cryptographic material:** Just a random identifier
- **Permissions-bound:** Session carries ACL (chains, methods, accounts, confirmation level)

### Storage Format
```typescript
// Stored in chrome.storage.local at key "azguard:core:dappSessions@{sessionId}"
{
  id: string,                    // 64 hex chars
  profileId: string,
  dappMetadata: { name, description, logo, url },
  permissions: [{ chains, methods, events }],
  accounts: ["aztec:chainId:address", ...],
  confirmationLevel: AccessLevel,
  expiry: number                 // Date.now() + 7 days
}
```

### Findings

**[F-S7-01] MEDIUM - Session Stored Plaintext**
- File: `src/wallet/services/dapp-session/service.ts:99`
- Session data (including permissions and authorized accounts) stored unencrypted
- If local storage is exfiltrated, attacker knows which dApps have access to which accounts
- **Recommendation:** Encrypt session data at rest

**[F-S7-02] MEDIUM - Clock-Based Expiry**
- File: `src/wallet/services/dapp-session/service.ts:175-190`
- Expiry check: `session.expiry < Date.now()`
- Vulnerable to system clock manipulation (set clock backward → sessions never expire)
- **Recommendation:** Store session creation timestamp alongside expiry for validation

**[F-S7-03] LOW - Bearer Token Model**
- Session ID is a bearer token — possession equals authorization
- If a dApp leaks the session ID, any script can use it
- Mitigated by: session is only useful through the extension's RPC channel

---

## Summary: Secret Sensitivity Matrix

| Secret | Generation | Storage | Encryption | Clearing | Risk |
|--------|-----------|---------|------------|----------|------|
| Password | User input | Session (base64 SHA-256) | SHA-256 only | Lock/TTL | **CRITICAL** |
| Master Secret | `Fr.random()` | Local (AES-GCM) | PBKDF2 + AES-256-GCM | `= undefined` | **HIGH** |
| Account Secret | Poseidon2 derivation | Memory only | None (derived) | GC | **MEDIUM** |
| Signing Key | SHA-512 derivation | Memory only | None (derived) | GC | **MEDIUM** |
| Passkey PRF | WebAuthn API | Never stored | HKDF-SHA256 | After derivation | **LOW** |
| ECDH Key | P-521 generation | Memory only | Asymmetric | Page navigation | **LOW** |
| Session Token | `getRandomHex(64)` | Local (plaintext) | None | Explicit/expiry | **MEDIUM** |
