# Phase 4 — Storage & Data at Rest

## F-P4-01: Plaintext Storage of Sensitive Metadata (MEDIUM)

**Files:**
- `src/wallet/storage/entity_storage.ts:1-76`
- `src/wallet/storage/value-storage.ts:1-27`

Both `EntityStorage` and `ValueStorage` wrap `chrome.storage.local` / `chrome.storage.session` with no encryption layer. The following sensitive data is stored as plaintext JSON:

| Service | Storage Key | Data | Risk |
|---------|------------|------|------|
| AccountService | `azguard:core:accounts` | Addresses, names, indices | Address correlation |
| TokenService | `azguard:core:tokens` | Token contract addresses, decimals | Portfolio fingerprinting |
| TokenBalanceService | `azguard:core:token-balances` | Balance amounts | Wealth exposure |
| TransactionService | `azguard:core:txs` | Full tx history with call data | Activity tracking |
| DappSessionService | `azguard:core:dappSessions` | Session tokens, dApp metadata, permissions | dApp usage tracking |
| ContactService | `azguard:core:contacts` | Contact addresses, names | Social graph |
| AuthRegistryService | `azguard:core:auth-registry` | Authwit hashes | Auth pattern exposure |
| NetworkService | `azguard:core:networks` | RPC URLs, chain IDs | Node preference |
| ConfigStore | `azguard:config` | Privacy settings, stealth mode | Config fingerprinting |
| FpcService | `azguard:core:fpcs` | Fee payment contracts | Fee strategy |

**Impact:** Medium. An attacker with filesystem access (malware, physical access, forensic analysis of unencrypted disk) can extract the full wallet activity history, token balances, and social graph without knowing the password. The password only protects the master secret / private keys.

**Recommendation:**
1. Encrypt the entire storage namespace under the profile encryption key
2. At minimum, encrypt high-value fields: transaction history, balances, and dApp sessions
3. Consider using IndexedDB with encryption wrapper for structured data

---

## F-P4-02: Profile Encryption — Strong (INFO)

**File:** `src/wallet/services/profile/encryption/encryption-key.ts:8-43`

Master secrets are encrypted with PBKDF2-SHA256 (600k iterations) → AES-256-GCM. Ciphertext format: `[1-byte version][12-byte IV][ciphertext]`. The encryption key is derived fresh from the password on each unlock — it is never stored.

This is the only encrypted storage in the wallet. It correctly protects the most critical asset (master secret / seed).

---

## F-P4-03: Password Hash in Session Storage (MEDIUM)

**File:** `src/wallet/services/profile/service.ts:567-572`

```typescript
const session: Session = {
    profile: profileId,
    passhash: passhash ? Buffer.from(passhash).toString("base64") : undefined,
    since: Date.now(),
};
await this.session.set(session);
```

The SHA-256 password hash is stored in `chrome.storage.session` (memory-backed, cleared on extension unload). This enables session persistence across popup open/close cycles without re-prompting the password.

**Impact:** Medium. While `chrome.storage.session` is memory-only and cleared on browser restart, the password hash is accessible to any code running in the extension context. If a supply-chain attack compromises a dependency, the hash could be exfiltrated. The hash is SHA-256 of the plaintext password — with a rainbow table or GPU cracking, the original password could be recovered.

**Recommendation:**
1. Store a derived session token instead of the raw password hash
2. Apply PBKDF2/HKDF to the passhash before storing in session: `sessionKey = HKDF(passhash, "session")`
3. Add a session timeout (e.g., 30 minutes of inactivity) that clears the session

---

## F-P4-04: Chrome Storage API Separation (INFO)

| API | Persistence | Used For |
|-----|-------------|----------|
| `chrome.storage.local` | Persistent (survives restart) | All entity data, config |
| `chrome.storage.session` | Memory-only (cleared on unload) | Password hash session |

The separation is appropriate — session-sensitive data uses memory-only storage. The main gap is that `chrome.storage.local` data is not encrypted (see F-P4-01).
