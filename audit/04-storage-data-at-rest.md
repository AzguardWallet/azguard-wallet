# Phase 4: Storage & Data at Rest Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 1 CRITICAL, 3 HIGH, 6 MEDIUM, 0 LOW

---

## Storage Inventory

### Chrome Storage: LOCAL (Plaintext)

| Storage Key | Service | Data Stored | Sensitivity | Encrypted |
|------------|---------|-------------|-------------|-----------|
| `azguard:core:profiles` | ProfileService | Profile metadata, encrypted secrets | HIGH | Partial (secrets encrypted, metadata plaintext) |
| `azguard:core:accounts` | AccountService | Addresses, names, indices, visibility | HIGH | No |
| `azguard:core:dappSessions` | DappSessionService | dApp URLs, permissions, account list, expiry | HIGH | No |
| `azguard:core:txs` | TransactionService | Tx hashes, calls, nonces, fee data | MEDIUM | No |
| `azguard:core:tx-cursors` | TransactionService | Block sync cursors | LOW | No |
| `azguard:core:token-balances` | TokenBalanceService | Token balances, accounts, token IDs | MEDIUM | No |
| `azguard:core:tokens` | TokenService | Token metadata, addresses, symbols | LOW | No |
| `azguard:core:contacts` | ContactService | Contact names, addresses | MEDIUM | No |
| `azguard:core:networks` | NetworkService | RPC URLs, chain IDs | MEDIUM | No |
| `azguard:core:auth-registry` | AuthRegistryService | Auth witness data, accounts | MEDIUM | No |
| `azguard:core:auth-registry-enabled` | AuthRegistryService | Enablement status per account | LOW | No |
| `azguard:core:fpcs` | FpcService | Fee payment contract info | LOW | No |
| `azguard:config` | ConfigStore | All wallet settings (23 config props) | LOW | No |

### Chrome Storage: SESSION (Plaintext)

| Storage Key | Service | Data Stored | Sensitivity | Encrypted |
|------------|---------|-------------|-------------|-----------|
| `azguard:core:session` | ProfileService | Profile ID, **PASSHASH**, timestamp | **CRITICAL** | No |

### UI State Storage (Chrome Storage: LOCAL)

| Storage Key | Data Stored | Sensitivity |
|------------|-------------|-------------|
| `azguard:ui:activeAccount` | Currently selected account address | MEDIUM |
| `azguard:ui:activeNetwork` | Active network ID | LOW |
| `azguard:ui:lastActiveNetwork@{profileId}` | Last viewed network per profile | LOW |
| `azguard:ui:balanceDisplayOption@{profileId}` | Display preference | LOW |
| `azguard:ui:lastActiveProfile` | Last logged-in profile ID | LOW |
| `azguard:ui:feePaymentMethods` | Selected fee payment method | LOW |
| `azguard:ui:sentinel` | Sentinel value for storage detection | NONE |

---

## CRITICAL FINDINGS

### F-P4-01: CRITICAL — Passhash Stored in Session Storage

**File:** `src/wallet/services/profile/service.ts:567-572`
```typescript
const session: Session = {
    profile: profileId,
    passhash: passhash ? Buffer.from(passhash).toString("base64") : undefined,
    since: Date.now(),
};
await this.session.set(session);
```

**Issue:** The SHA-256 hash of the user's password is stored in plaintext in `chrome.storage.session`. Combined with F-P1-01 (single SHA-256, no salt), this provides a fast-crackable password to any attacker with session storage access.

**Impact:** An attacker who obtains session storage can:
1. Crack the password offline (SHA-256 at ~1B hashes/sec on GPU)
2. Use `EncryptionKey.fromPasshash()` directly to decrypt profile secrets
3. Gain full wallet access without knowing the password

**Fix:** Do not persist passhash. Generate a random session token instead. Require re-authentication on browser restart.

---

## HIGH FINDINGS

### F-P4-02: HIGH — dApp Sessions Stored Plaintext with Account Addresses

**File:** `src/wallet/services/dapp-session/service.ts:27, 99`
```typescript
private readonly storage = new EntityStorage<DappSession>("azguard:core:dappSessions", StorageType.Local);
// ...
await this.storage.set(session.id, session);
```

**What's stored plaintext:** Session ID, profile ID, dApp metadata (name, URL, logo), permissions, connected account addresses, confirmation level, expiry.

**Impact:** Reveals which dApps the user interacts with, which accounts are connected to each dApp, and permission levels. Sessions accumulate over 7-day expiry windows.

**Fix:** Encrypt dApp session metadata using a profile-scoped key.

---

### F-P4-03: HIGH — Transaction History Stored Plaintext

**File:** `src/wallet/services/transaction/service.ts:64`
```typescript
private readonly txs = new EntityStorage<Tx>("azguard:core:txs", StorageType.Local);
```

**What's stored plaintext:** Transaction origin, chain ID, sender account address, function calls with contract addresses and arguments, nonce, fee payment method, tx hash, timestamps, status.

**Impact:** Complete transaction history reveals asset movements, contract interactions, and spending patterns.

**Fix:** Encrypt transaction history using account-derived keys.

---

### F-P4-04: HIGH — Token Balances Stored Plaintext with Account Mapping

**File:** `src/wallet/services/token-balance/service.ts:31`
```typescript
private readonly balances = new EntityStorage<TokenBalanceRaw>("azguard:core:token-balances", StorageType.Local);
```

**What's stored plaintext:** Profile ID, account address, token ID, current balance, last refresh timestamp.

**Impact:** Maps specific accounts to token balances — reveals wealth and token holdings.

**Fix:** Encrypt token balance data with account-derived keys.

---

## MEDIUM FINDINGS

### F-P4-05: MEDIUM — Account List Stored Plaintext with Derivation Indices

**File:** `src/wallet/services/account/service.ts:22`
```typescript
private readonly storage = new EntityStorage<Account>("azguard:core:accounts", StorageType.Local);
```

**What's stored plaintext:** Profile ID, chain ID, address, derivation index, account type, user-assigned name, visibility flag.

**Impact:** All account addresses exposed. Derivation indices leak information about account creation order. User-assigned names could leak identity.

---

### F-P4-06: MEDIUM — Contacts Stored Plaintext

**File:** `src/wallet/services/contact/service.ts:21`

**What's stored plaintext:** Contact names, addresses, profile IDs.

**Impact:** Contact list reveals frequently interacted addresses. Combined with transaction history, can correlate accounts to contacts.

---

### F-P4-07: MEDIUM — Auth Registry Stored Plaintext

**File:** `src/wallet/services/auth-registry/service.ts:29-30`

**What's stored plaintext:** Account addresses, auth witness hashes, detailed authorization data.

**Impact:** Reveals which accounts have created authorization witnesses and for what operations.

---

### F-P4-08: MEDIUM — No Storage Cleanup on Logout/Lock

**File:** `src/wallet/services/profile/service.ts:507-516`
```typescript
private async _closeSession() {
    try {
        await this.session.delete();  // Only deletes session object
        // Does NOT clear other storage keys
    }
}
```

**Issue:** On logout, only `azguard:core:session` is deleted. All other sensitive data remains:
- Active account address (`azguard:ui:activeAccount`)
- Transaction history, dApp sessions, contacts, balances
- All profile-scoped data

**Impact:** Physical access after logout exposes all operational data.

**Fix:** Clear profile-scoped data on logout, at minimum UI state keys.

---

### F-P4-09: MEDIUM — Storage Key Enumeration Reveals Activity

**Issue:** All storage keys follow a predictable pattern (`azguard:core:{type}@{id}`). An attacker with storage read access can enumerate keys to learn:
- Number of accounts, transactions, contacts
- Which dApps are connected (session IDs)
- Activity patterns from key timestamps

**Fix:** Hash storage keys with a per-profile salt.

---

### F-P4-10: MEDIUM — Export Functions Return Plaintext Secrets

**File:** `src/wallet/services/profile/service.ts:422-455`
```typescript
public async exportPlain(id: string, password?: string): Promise<string> {
    // Returns plaintext secret in base64
}

public async exportMnemonic(id: string, password: string): Promise<string[]> {
    // Returns mnemonic words
}
```

**Issue:** Export functions return raw secrets to the popup UI with no additional encryption. Contact export also returns unencrypted JSON.

**Fix:** Encrypt export files with a user-provided password. Require explicit confirmation.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| Profile secrets encrypted | AES-256-GCM with PBKDF2-600k — strong |
| No localStorage/sessionStorage | Correctly uses chrome.storage (isolated from page context) |
| No IndexedDB in main extension | Only used by PXE offscreen document for legitimate crypto operations |
| Profile deletion cascades | Contacts, dApp sessions cleaned up on profile delete |
| Session TTL enforced | Default 30-minute expiry on session storage |

---

## Storage Access Control

| Context | chrome.storage.local | chrome.storage.session | IndexedDB |
|---------|---------------------|----------------------|-----------|
| Page scripts | NO | NO | Own origin only |
| Content scripts | NO | NO | Own origin only |
| Extension popup | YES | YES | Extension origin |
| Background SW | YES | YES | Extension origin |
| Offscreen doc | YES | YES | Extension origin |
| Other extensions | NO | NO | Own origin only |

**Key insight:** While page scripts and content scripts cannot access chrome.storage, a **compromised or malicious extension** could read all plaintext data.
