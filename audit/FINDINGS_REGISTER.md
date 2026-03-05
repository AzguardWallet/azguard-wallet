# Azguard Wallet Audit — Master Findings Register

**Last Updated:** 2026-02-26
**Phases Complete:** 0, 1, 2, 3, 4, 5, 6, 7, 8 (ALL COMPLETE)
**Total Findings:** 120

---

## Severity Summary

| Severity | Count | Phases |
|----------|-------|--------|
| CRITICAL | 8 | P0: 2, P1: 1, P2: 3, P3: 3, P4: 1 |
| HIGH | 20 | P0: 2, P1: 4, P2: 4, P3: 5, P4: 3, P5: 2, P6: 2 |
| MEDIUM | 62 | P0: 6, P1: 6, P2: 8, P3: 10, P4: 6, P5: 10, P6: 9, P7: 8, P8: 14 |
| LOW | 21 | P0: 6, P2: 1, P3: 2, P5: 2, P6: 4, P7: 7, P8: 12 |
| INFO | 9 | P0: 6, P1: 3 |

---

## ALL CRITICAL FINDINGS

| ID | Phase | Finding | File | Fix Priority |
|----|-------|---------|------|-------------|
| F-P1-01 | 1 | **Single SHA-256 password hashing** — no salt, no iterations, brute-forceable in seconds | `encryption-key.ts:94-96` | IMMEDIATE |
| F-P3-01 | 3 | **Lock deadlock bug** — `lock.enter()` instead of `lock.leave()` in addDappSession finally block | `dapp-session/service.ts:103` | IMMEDIATE |
| F-P3-02 | 3 | **No dApp origin binding** — sessions are bearer tokens with no caller identification | `dapp-session/spec.ts:16-24` | IMMEDIATE |
| F-P4-01 | 4 | **Passhash stored in session storage** — SHA-256 of password in plaintext chrome.storage.session | `profile/service.ts:567-572` | IMMEDIATE |
| F-P3-03 | 3 | **Contract instance/artifact unvalidated** — TODO in code, arbitrary data passes through | `rpc/utils.ts:227-235` | HIGH |
| F-P2-01 | 2 | **Math.random() for request IDs** — predictable across all 3 communication layers | Multiple files | HIGH |
| F-P2-02 | 2 | **No request timeout** — promises hang forever if response never arrives | Multiple files | HIGH |
| F-P2-03 | 2 | **Incomplete CSP** — missing default-src, object-src, frame-src, connect-src | `manifest.config.ts:35-36` | HIGH |

---

## ALL HIGH FINDINGS

| ID | Phase | Finding | File |
|----|-------|---------|------|
| F-P1-02 | 1 | IV-to-salt derivation coupling in EncryptionKey | `encryption-key.ts:31-44` |
| F-P1-03 | 1 | PRF output not validated in passkey credential | `passkey/credential.ts:22-28` |
| F-P1-04 | 1 | Passkey window race condition & promise leak | `passkey/service.ts:50-89` |
| F-P1-05 | 1 | Math.random() in getRandomElement() | `utils/random.ts:5-10` |
| F-P2-04 | 2 | Object.defineProperty missing configurable: false | `content-script/utils.ts:1-11` |
| F-P2-05 | 2 | ECDH handshake state machine fragility | `messenger/client .ts:117-146` |
| F-P2-06 | 2 | JSON.parse without try-catch in contact import | `contact/service.ts:190` |
| F-P2-07 | 2 | No sender validation in offscreen service | `offscreen/service.ts:39-44` |
| F-P3-04 | 3 | getSession()/closeSession() no ownership check | `rpc/service.ts:66-82` |
| F-P3-05 | 3 | Scope validation uses endsWith() (partial match) | `dapp-interaction/service.ts:294-300` |
| F-P3-06 | 3 | Popup flooding — no concurrent popup limit | `dapp-interaction/service.ts:137-144` |
| F-P3-07 | 3 | Interaction ID 32-bit + no auth on resolve/reject | `dapp-interaction/service.ts:115-117, 65-79` |
| F-P3-08 | 3 | parseOptionalProp() passes arbitrary values | `rpc/utils.ts:648-654` |
| F-P4-02 | 4 | dApp sessions stored plaintext with account addresses | `dapp-session/service.ts:27, 99` |
| F-P4-03 | 4 | Transaction history stored plaintext | `transaction/service.ts:64` |
| F-P4-04 | 4 | Token balances stored plaintext with account mapping | `token-balance/service.ts:31` |
| F-P5-01 | 5 | Content script injected into all pages (*://*/*) | `manifest.config.ts:25-31` |
| F-P5-02 | 5 | No method whitelist on content script proxy | `proxy/server.ts:51-58` |
| F-P6-01 | 6 | Incomplete on-chain validation of contract metadata | `execution/service.ts:797-820` |
| F-P6-02 | 6 | Missing bounds checking on gas estimates (gasPadding) | `execution/service.ts:1111-1130` |

---

## ALL MEDIUM FINDINGS (48)

| ID | Phase | Finding | File |
|----|-------|---------|------|
| F-P1-06 | 1 | Passhash stored in session storage | `profile/service.ts:567-571` |
| F-P1-07 | 1 | Session restore bypasses password entry | `profile/service.ts:531-558` |
| F-P1-08 | 1 | Hardcoded ENCRYPTION_GUARD | `profile/spec.ts:5` |
| F-P1-09 | 1 | Account secret derivation lacks domain separation | `account/service.ts:148` |
| F-P1-10 | 1 | Account secret sent to PXE (accepted trust boundary) | `azguard-v0-base.ts:67` |
| F-P1-11 | 1 | Session TTL can be disabled (sessionTtl=0) | `profile/service.ts:57` |
| F-P2-08 | 2 | Offscreen client UID too short (32 bits) | `offscreen/client.ts:18-19` |
| F-P2-09 | 2 | Event message routing spoofable | `offscreen/client.ts:43-50` |
| F-P2-10 | 2 | Multiple inpage injection race condition | `inpage.ts:10-12` |
| F-P2-11 | 2 | Request ID validation insufficient | `background/service.ts:66-70` |
| F-P2-12 | 2 | JSON.parse in decrypt without wrapper | `messenger/utils.ts:73-81` |
| F-P2-13 | 2 | Metadata leakage in encrypted channel | Content script messenger |
| F-P2-14 | 2 | Promise rejection on disconnect not error-handled | `background/client.ts:49-64` |
| F-P2-15 | 2 | Port disconnection cleanup (logging) | `background/service.ts` |
| F-P3-09 | 3 | CAIP account address not validated | `rpc/utils.ts:552-564` |
| F-P3-10 | 3 | ChainId accepts hex via unary + | `rpc/utils.ts:558, 572, 585` |
| F-P3-11 | 3 | Array bounds not validated | `rpc/utils.ts:544-550` |
| F-P3-12 | 3 | dApp metadata XSS potential (logo as data: URI) | `rpc/utils.ts:61-80` |
| F-P3-13 | 3 | Session expiry unvalidated in upgradeDappSession() | `dapp-session/service.ts:133-156` |
| F-P3-14 | 3 | Case-sensitive account address comparison | `dapp-interaction/service.ts:282-286` |
| F-P3-15 | 3 | No rate limiting anywhere | Multiple files |
| F-P3-16 | 3 | WalletConnect session topic used as dApp session ID | `wallet-connect/service.ts:249` |
| F-P3-17 | 3 | WC namespace validation missing | `wallet-connect/service.ts:212-217` |
| F-P3-18 | 3 | WC URI not validated before pairing | `wallet-connect/service.ts:190-198` |
| F-P4-05 | 4 | Account list stored plaintext with derivation indices | `account/service.ts:22` |
| F-P4-06 | 4 | Contacts stored plaintext | `contact/service.ts:21` |
| F-P4-07 | 4 | Auth registry stored plaintext | `auth-registry/service.ts:29-30` |
| F-P4-08 | 4 | No storage cleanup on logout/lock | `profile/service.ts:507-516` |
| F-P4-09 | 4 | Storage key enumeration reveals activity | All storage keys |
| F-P4-10 | 4 | Export functions return plaintext secrets | `profile/service.ts:422-455` |
| F-P5-03 | 5 | No port sender verification in background service | `background/service.ts:39-46` |
| F-P5-04 | 5 | Offscreen accepts messages without sender check | `offscreen/service.ts:39-49` |
| F-P5-05 | 5 | CSP missing style-src, img-src, connect-src, frame-ancestors | `manifest.config.ts:35-37` |
| F-P5-06 | 5 | ECDH handshake allows recovery after block | `messenger/client .ts:117-147` |
| F-P5-07 | 5 | No rate limiting on proxy requests | `proxy/server.ts:51-76` |
| F-P5-08 | 5 | Offscreen document startup race condition | `utils/offscreen.ts:25-50` |
| F-P5-09 | 5 | No registry URL path traversal prevention | `pxe/service.ts:382-416` |
| F-P5-10 | 5 | Popup window missing clickjacking protection | `dapp-interaction/service.ts:137-142` |
| F-P5-11 | 5 | Session-client map memory leak in proxy server | `proxy/server.ts:37-49` |
| F-P5-12 | 5 | Event handler errors silently swallowed | `proxy/client.ts:73-76` |
| F-P6-03 | 6 | Profile lock not held during silent execution | `dapp-interaction/service.ts:147-223` |
| F-P6-04 | 6 | Session TTL not re-validated during operations | `profile/service.ts:50-71` |
| F-P6-05 | 6 | Token balance worker silent death | `token-balance/service.ts:227-280` |
| F-P6-06 | 6 | FPC discovery race condition | `fpc/service.ts:46-126` |
| F-P6-07 | 6 | Hardcoded single FPC address discovery | `fpc/service.ts:46-125` |
| F-P6-08 | 6 | Fee payload mutation risk in execution | `execution/service.ts:1200-1250` |
| F-P6-09 | 6 | Contact input validation insufficient | `contact/service.ts:76-100` |
| F-P6-10 | 6 | No stale node detection | `network/service.ts:22-40` |
| F-P6-11 | 6 | Task service memory leak | `task/service.ts:110-170` |
| F-P7-01 | 7 | Clipboard not cleared after copying seed phrase | `export/seed.vue:67-73` |
| F-P7-02 | 7 | Clipboard not cleared after copying private key | `export/key.vue:91-97` |
| F-P7-03 | 7 | General copy handler never clears clipboard | `BalanceView.vue:96-99` |
| F-P7-04 | 7 | External image loading without URL validation | `externalImage.ts:19-55` |
| F-P7-05 | 7 | dApp logo URL not validated before loading | `connect/index.vue, execute/index.vue` |
| F-P7-06 | 7 | External links opened without protocol validation | `externalLinks.ts:27-56` |
| F-P7-07 | 7 | Error messages displayed without sanitization | `connect/execute windows` |
| F-P7-08 | 7 | Pinia state not explicitly cleared on lock | `app.store.ts:42-200` |

---

## TOP 10 RECOMMENDED FIXES (Priority Order)

### 1. Fix Deadlock Bug (F-P3-01) — IMMEDIATE
**Effort:** 1 line change | **Impact:** Wallet non-functional after first dApp connection
```diff
- this.lock.enter();
+ this.lock.leave();
```

### 2. Upgrade Password Hashing (F-P1-01) — IMMEDIATE
**Effort:** Medium (migration needed) | **Impact:** All passwords brute-forceable

### 3. Remove Passhash from Session Storage (F-P4-01) — IMMEDIATE
**Effort:** Medium | **Impact:** Eliminates stored password hash attack vector

### 4. Add Origin Binding to Sessions (F-P3-02) — IMMEDIATE
**Effort:** Medium | **Impact:** Prevents cross-dApp session hijacking

### 5. Fix Object.defineProperty (F-P2-04) — HIGH
**Effort:** 1 line change | **Impact:** Prevents page scripts from overwriting window.azguard

### 6. Add Request Timeouts (F-P2-02) — HIGH
**Effort:** Low | **Impact:** Prevents UI hangs and memory leaks

### 7. Replace Math.random() (F-P2-01) — HIGH
**Effort:** Low | **Impact:** Unpredictable request IDs across all layers

### 8. Fix CSP (F-P2-03 + F-P5-05) — HIGH
**Effort:** Low | **Impact:** Restricts extension page capabilities

### 9. Restrict Content Script Scope (F-P5-01) — HIGH
**Effort:** Low | **Impact:** Reduces attack surface on non-wallet pages

### 10. Encrypt Sensitive Storage (F-P4-02, F-P4-03, F-P4-04) — HIGH
**Effort:** High | **Impact:** Protects operational data from storage compromise

---

## Findings by File (Cross-Reference)

| File | Findings |
|------|----------|
| `encryption-key.ts` | F-P1-01 (CRIT), F-P1-02 (HIGH) |
| `profile/service.ts` | F-P1-06, F-P1-07, F-P1-11, F-P4-01 (CRIT), F-P4-08, F-P4-10, F-P6-04 |
| `passkey/credential.ts` | F-P1-03 (HIGH) |
| `passkey/service.ts` | F-P1-04 (HIGH) |
| `utils/random.ts` | F-P1-05 (HIGH) |
| `content-script/utils.ts` | F-P2-04 (HIGH) |
| `proxy/client.ts` | F-P2-01 (CRIT), F-P5-12 |
| `proxy/server.ts` | F-P5-02 (HIGH), F-P5-07, F-P5-11 |
| `background/client.ts` | F-P2-01 (CRIT), F-P2-02 (CRIT) |
| `background/service.ts` | F-P5-03 |
| `offscreen/client.ts` | F-P2-01 (CRIT), F-P2-02 (CRIT), F-P2-08 |
| `offscreen/service.ts` | F-P2-07 (HIGH), F-P5-04 |
| `messenger/client .ts` | F-P2-05 (HIGH), F-P5-06 |
| `manifest.config.ts` | F-P2-03 (CRIT), F-P5-01 (HIGH), F-P5-05 |
| `contact/service.ts` | F-P2-06 (HIGH), F-P6-09 |
| `inpage.ts` | F-P2-10 |
| `dapp-session/service.ts` | F-P3-01 (CRIT), F-P3-13, F-P4-02 (HIGH) |
| `dapp-session/spec.ts` | F-P3-02 (CRIT) |
| `rpc/service.ts` | F-P3-04 (HIGH), F-P3-19, F-P3-20 |
| `rpc/utils.ts` | F-P3-03 (CRIT), F-P3-08 (HIGH), F-P3-09-12 |
| `dapp-interaction/service.ts` | F-P3-05 (HIGH), F-P3-06 (HIGH), F-P3-07 (HIGH), F-P3-14, F-P3-15, F-P5-10, F-P6-03 |
| `wallet-connect/service.ts` | F-P3-16, F-P3-17, F-P3-18 |
| `execution/service.ts` | F-P6-01 (HIGH), F-P6-02 (HIGH), F-P6-08, F-P6-13 |
| `transaction/service.ts` | F-P4-03 (HIGH) |
| `token-balance/service.ts` | F-P4-04 (HIGH), F-P6-05 |
| `account/service.ts` | F-P4-05 |
| `auth-registry/service.ts` | F-P4-07 |
| `fpc/service.ts` | F-P6-06, F-P6-07 |
| `network/service.ts` | F-P6-10 |
| `task/service.ts` | F-P6-11 |
| `utils/offscreen.ts` | F-P5-08 |
| `pxe/service.ts` | F-P5-09 |
| `app.store.ts` | F-P7-08 |
| `externalImage.ts` | F-P7-04 |
| `externalLinks.ts` | F-P7-06 |
| `export/seed.vue` | F-P7-01 |
| `export/key.vue` | F-P7-02 |
| `string.ts` | F-P7-14 |

---

## Phase Status

| Phase | Status | Findings | Document |
|-------|--------|----------|----------|
| 0: Architectural Mapping | COMPLETE | 22 | `00-SUMMARY.md` |
| 1: Key Management & Crypto | COMPLETE | 14 | `01-key-management-crypto.md` |
| 2: Message Passing | COMPLETE | 16 | `02-message-passing.md` |
| 3: RPC & dApp Authorization | COMPLETE | 20 | `03-rpc-dapp-authorization.md` |
| 4: Storage & Data at Rest | COMPLETE | 10 | `04-storage-data-at-rest.md` |
| 5: Extension Security | COMPLETE | 14 | `05-extension-security.md` |
| 6: Service Deep Dive | COMPLETE | 15 | `06-service-deep-dive.md` |
| 7: UI & Frontend Security | COMPLETE | 15 | `07-ui-frontend-security.md` |
| 8: Implementation Quality | COMPLETE | 22 | `08-implementation-quality.md` |

---

## Audit Complete

All 8 phases finished. **120 total findings** across the full Azguard Wallet codebase on branch `v4-devnet-2`.
