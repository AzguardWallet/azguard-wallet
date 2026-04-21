# Crypto, Storage, and Key Management

_Read date: 2026-04-20. Architect: Claude Explore agent output, salvaged to file._

## 1. Storage Layer

**Files:**
- `src/wallet/storage/entity_storage.ts` — `EntityStorage<T>` multi-entity keyed as `root@id`. Supports `getVersion()`/`setVersion()` (line 12–19).
- `src/wallet/storage/value-storage.ts` — `ValueStorage<T>` single value.
- `src/wallet/storage/simple-storage.ts` — `SimpleStorage<T>` kv pairs, `root:key` pattern.
- `src/wallet/storage/migrate.ts` — `STORAGE_VERSION_KEY = "nulo:core:storage-version"`, `CURRENT_VERSION = 2`. Destructive migration: wipes accounts and PXE IndexedDB on mismatch (lines 13–16).

**Backing stores:**
- `chrome.storage.local` (persistent)
- `chrome.storage.session` (cleared on SW termination)

**Encryption-at-rest:** NOT automatic. Delegated to `EncryptionKey` class at profile layer.

## 2. Master Key + Seed Derivation

**Password path** (`src/wallet/services/profile/service.ts` + `profile/encryption/encryption-key.ts`):
1. Password → SHA-256 → `EncryptionKey.getPasshash()` (line 97-100)
2. Hash imported as PBKDF2 base key (line 88)
3. Master secret: `Fr.random().toBuffer()` (32 bytes) at profile creation (line 95)
4. AES-GCM encrypted via PBKDF2: **600,000 iterations, SHA-256** (lines 16-18). OWASP 2023 minimum.
   - IV: 12 random bytes
   - Salt: SHA-256 of IV (unusual — typical would use independent salt)
5. Encrypted secret stored base64 in profile `guard` (sentinel) and `secret` fields (lines 109-111).

**Passkey path** (`src/wallet/services/passkey/credential.ts`):
1. WebAuthn PRF output → HKDF IKM (line 28)
2. Salt: SHA-256(`PASSKEY_KDF_LABEL || credential_id_bytes`) (line 27)
3. Master secret: HKDF-SHA256, 256-bit output (lines 34-38)
4. `Fr.fromBufferReduce()` (line 39)

**Account derivation** (`src/wallet/services/account/service.ts`):
- Account secret = `Poseidon2Hash([master, chainId, type, index])` (line 122)
- Signing key = `deriveSigningKey(secret)` from `@aztec/stdlib` (nulo-account.ts:64)

**KDF labels (domain separators, must NEVER change — breaks keys):**
- `"nulo:profile:v1"` — PASSKEY_PRF_LABEL (passkey/spec.ts:4)
- `"nulo:kdf:v1"` — PASSKEY_KDF_LABEL (credential.ts:8)
- `"nulo:master:v1"` — PASSKEY_MASTER_LABEL (credential.ts:9)
- `AccountType.Nulo_v1 = 0` — embedded in Poseidon hash (spec.ts comment: "NEVER change it")

## 3. Passkey Integration

**File:** `src/popup/windows/passkey/index.vue` + `src/wallet/services/passkey/`

- **RP ID:** `"nulo.sh"` (line 40)
- **Must match** `host_permissions` in manifest.config.ts line 14 (`"https://nulo.sh/"`)
- **CRITICAL:** changing RP ID invalidates all existing passkeys (crypto-bound)

**Flow:**
1. Challenge: 32 random bytes (line 29)
2. PRF input: SHA-256("nulo:profile:v1") (line 31)
3. Resident key + user verification required (lines 48-52)
4. Extensions: PRF with input, PRF output extracted (lines 55-66)
5. Throws if PRF unavailable (line 61, 101). Fallback to `get()` exists for compat.

## 4. In-Memory Secret Handling

**Location of unlocked secret:** `ProfileService.activeSession` (service.ts:40), type `Fr` (field element from `@aztec/foundation`). **Held in service worker memory, not popup.**

**Session metadata persists in `chrome.storage.session`:**
```ts
{ profile: string, passhash?: string, since: number }  // spec.ts:31-38
```

**⚠️ Passhash stored in session (service.ts:564, base64 encoded).**

**SW restart recovery:** `init()` validates session and calls `restorePasswordSession()` (lines 50-71). Passhash must be present in session to decrypt secret.

**Secret clearing:** `_closeSession()` deletes session entry + clears `activeSession` (lines 507-517). Called on lock, expiration, corruption, profile deletion.

**No explicit zeroization** — JS has no secure buffer wipe. GC timing unpredictable.

## 5. Auto-Lock / Session TTL

**Default TTL:** 30 minutes (`1_800_000` ms) — `config.ts:20`.

**⚠️ REACTIVE, not proactive.** Checked on every `_getSession()` call (profile/service.ts:499-505). No background timer.

Consequence: if no service method is called, secret stays in memory past TTL until SW naturally unloads.

**Lock triggers:**
1. Explicit `lockActiveProfile()`
2. Session expiration (on next method call)
3. Session corruption / wrong passhash
4. Profile deletion

**Refresh:** `refreshSession()` updates `since` timestamp without re-auth (lines 519-529).

## 6. Chrome Storage Attack Surface

**Plaintext:**
- Profile metadata (name, type, id) — `nulo:core:profiles`
- Account metadata (address, index, name, visibility) — `nulo:core:accounts`
- UI state (active account) — `nulo:ui:activeAccount`
- Networks, tokens, contacts, contracts
- Session metadata: profile id, **passhash (base64)**, timestamp — `nulo:core:session`
- Transaction cursors, token balances (no secrets, but privacy-sensitive)
- Logs in `chrome.storage.session` (may contain debug info)

**Encrypted:**
- Master secret (AES-GCM) in `profile.secret`
- Guard sentinel (AES-GCM) in `profile.guard`

## 7. Security Concerns (ranked)

### Critical
1. **Passhash in `chrome.storage.session`** (service.ts:564). If session storage leaks while SW is live, attacker can derive decryption key without password. Recommendation: store nothing that can decrypt the secret. Prefer re-auth on unlock, or explicitly accept that active password sessions are equivalent to unlocked secret access.
2. **No popup-side session liveness check** — popup may continue showing authenticated UI after SW-side session timeout.

### High
3. **No zeroization of decrypted buffers.**
4. **WebAuthn PRF extension assumption** — code throws without it; fallback branch present but untested path.
5. **RP ID hardcoded to `nulo.sh`** — no rotation mechanism; domain change = all passkeys lost.

### Medium
6. **Reactive TTL** means secrets can live past TTL in memory.
7. **Salt derived from IV** (SHA-256 of IV). Sound but unusual — convention is independent salt.
8. **`AccountType.Nulo_v1 = 0`** embedded in Poseidon. Enum refactor would break existing accounts.

### Low
9. **One-way storage migration** — destroys prior state; no rollback.
10. **Logs may carry sensitive data** — profile service logs decryption events.

## 8. Open questions

- Is passhash-in-session a conscious UX trade (so reopening popup doesn't re-prompt across SW restarts)? Needs product decision + explicit documentation.
- Should we zeroize `Uint8Array` backing the decrypted secret before letting it go out of scope? Tradeoff: GC timing unpredictable, but reduces dwell time.
- Does the passkey path also persist any session material, or is every unlock a fresh PRF call? (needs deeper trace — flagged for research.)
