# Azguard Wallet Security & Quality Audit Plan

**Branch:** v4-devnet-2
**Version:** 0.9.1
**Started:** 2026-02-26

---

## Audit Philosophy

1. **Understand first, judge second.** Each phase starts by mapping how things work before flagging issues.
2. **Follow the secrets.** Every phase traces where sensitive data (keys, secrets, sessions) flows.
3. **Trust boundaries are the audit surface.** Every crossing between contexts (page → content script → background → PXE) is a potential vulnerability.
4. **Severity-driven prioritization.** Critical/High findings get deep dives; informational findings get noted but don't block progress.

---

## Phase 0: Architectural Mapping (Foundation)
> *Goal: Build a complete mental model before diving into code.*

- [ ] **0.1** Map all trust boundaries and context transitions
  - Page script ↔ Content script (window.postMessage + ECDH)
  - Content script ↔ Background service worker (chrome.runtime.connect)
  - Background ↔ Offscreen PXE (chrome.runtime messaging)
  - Background ↔ Chrome storage (local + session)
  - Background ↔ External network (Aztec node RPC, faucet, WalletConnect)
- [ ] **0.2** Map the complete lifecycle of a secret
  - Password → passhash → PBKDF2 key → AES-GCM encryption of master secret
  - Master secret → Poseidon2 derivation → account secrets → signing keys
  - Session storage of passhash (unlock duration)
  - Passkey flow: PRF → master secret alternative path
- [ ] **0.3** Map the complete lifecycle of a transaction
  - dApp request → RPC service → session validation → execution service → account contract → PXE → Aztec node
  - Internal send → popup UI → execution service → same path
- [ ] **0.4** Map the dApp connection lifecycle
  - Page calls `window.azguard.createClient()` → ECDH handshake → encrypted channel → RPC invoke → session creation → permission grant → execution
- [ ] **0.5** Document all 23 services and their inter-dependencies
  - Which services call which other services
  - Which services hold references to sensitive data
  - Service startup ordering and initialization race conditions

---

## Phase 1: Key Management & Cryptography (CRITICAL)
> *Goal: Verify that secrets are generated, stored, derived, and destroyed correctly.*

### 1.1 Password & Master Secret
- [ ] Audit `ProfileService.createProfile()` — password hashing (SHA-256 concern)
- [ ] Audit `EncryptionKey` — PBKDF2 parameters (iterations, salt, IV reuse concern)
- [ ] Audit master secret generation — entropy source, randomness quality
- [ ] Audit master secret encryption/decryption round-trip
- [ ] Audit session storage of passhash — exposure window, cleanup on lock
- [ ] Verify secrets are zeroed from memory after use (or document impossibility in JS)

### 1.2 Account Secret Derivation
- [ ] Audit `AccountService.deriveAccountSecret()` — Poseidon2 derivation correctness
- [ ] Verify derivation path uniqueness (chainId, type, index collision space)
- [ ] Audit `AzguardV0Base` constructor — secret/signing key lifecycle
- [ ] Audit `registerAccount()` — secret passed to PXE, verify PXE doesn't persist it
- [ ] Trace signing key from derivation through to transaction signing

### 1.3 Passkey Integration
- [ ] Audit `PasskeyService` — WebAuthn PRF flow
- [ ] Verify PRF output → master secret derivation is cryptographically sound
- [ ] Check for credential metadata leakage (userHandle as profile ID)
- [ ] Verify passkey creation and authentication error handling

### 1.4 Encryption Primitives
- [ ] Audit `EncryptionKey.encrypt()` / `decrypt()` — AES-GCM correctness
- [ ] Verify IV uniqueness guarantees (current: random 12 bytes → SHA-256 salt)
- [ ] Audit ECDH key exchange in content script messenger
- [ ] Verify `getRandomHex()` uses `crypto.getRandomValues`
- [ ] Check for any use of `Math.random()` in security-sensitive contexts

---

## Phase 2: Message Passing & Trust Boundaries (CRITICAL)
> *Goal: Verify that every context boundary validates, authenticates, and sanitizes.*

### 2.1 Page ↔ Content Script Channel
- [ ] Audit ECDH handshake (`messenger/client.ts`, `messenger/server.ts`)
  - Key generation quality
  - MITM protection (first-handshake-wins concern)
  - Handshake replay protection
- [ ] Audit message encryption/decryption (`messenger/utils.ts`)
- [ ] Audit `window.postMessage` targetOrigin usage
- [ ] Verify no sensitive data leaks in unencrypted handshake phase
- [ ] Test: Can a malicious iframe intercept or spoof the handshake?

### 2.2 Content Script ↔ Background
- [ ] Audit `ProxyServer` — how RPC calls are forwarded to background
- [ ] Verify session-to-client mapping has origin binding
- [ ] Audit `ProxyClient` — how responses are routed back
- [ ] Check for message ordering / replay vulnerabilities
- [ ] Verify port disconnection cleanup (no dangling references)

### 2.3 Popup ↔ Background
- [ ] Audit `Service` base class — port connection handling, no auth check
- [ ] Audit `ServiceClient` base class — request ID generation (`Math.random()` concern)
- [ ] Verify `jsonSanitize()` removes dangerous types (functions, prototypes)
- [ ] Check for prototype pollution in message deserialization
- [ ] Audit error propagation — does it leak internal state?

### 2.4 Background ↔ Offscreen PXE
- [ ] Audit offscreen service message format
- [ ] Verify PXE client doesn't cache or log secrets
- [ ] Check for race conditions in PXE initialization
- [ ] Audit PXE reconnection/restart behavior

---

## Phase 3: RPC & dApp Authorization (HIGH)
> *Goal: Verify that dApps cannot exceed their granted permissions.*

### 3.1 RPC Method Surface
- [ ] Enumerate all RPC methods exposed (`RpcMethod` enum)
- [ ] For each method: document what it can do, what data it accesses
- [ ] Verify no admin/internal methods are exposed through RPC
- [ ] Check for method name injection or dynamic dispatch vulnerabilities

### 3.2 Parameter Validation
- [ ] Audit `rpc/utils.ts` — all `parse*` functions
- [ ] Identify all `TODO` validation gaps (contract instance, artifact)
- [ ] Verify CAIP format parsing is strict (chain, account, asset)
- [ ] Check for integer overflow in amount/balance parsing
- [ ] Test malformed inputs for each parse function

### 3.3 Session & Permission Model
- [ ] Audit `DappSessionService` — session creation, storage, expiry
- [ ] Audit `DappInteractionService` — permission checking before execution
- [ ] Trace `isConfirmationNeeded()` logic — when can dApps execute silently?
- [ ] Verify session revocation actually prevents further calls
- [ ] Check session expiry against clock manipulation
- [ ] Audit WalletConnect session handling separately

### 3.4 Rate Limiting & DoS Protection
- [ ] Check for rate limiting on RPC endpoint
- [ ] Check for rate limiting on session creation
- [ ] Verify resource cleanup on disconnection
- [ ] Check for memory leaks in long-lived sessions

---

## Phase 4: Storage & Data at Rest (HIGH)
> *Goal: Verify sensitive data is encrypted at rest and access-controlled.*

### 4.1 Storage Abstraction
- [ ] Audit `EntityStorage` — what data types are stored, plaintext vs encrypted
- [ ] Audit `ValueStorage` — session storage contents
- [ ] Audit `SimpleStorage` — raw storage usage
- [ ] Map ALL storage keys and classify sensitivity level
- [ ] Verify `unlimitedStorage` permission is justified

### 4.2 Sensitive Data Classification
- [ ] Identify all data stored in `chrome.storage.local` (persistent)
- [ ] Identify all data stored in `chrome.storage.session` (transient)
- [ ] Verify profile secrets are encrypted before storage
- [ ] Check: Are account addresses, dApp sessions, contacts stored plaintext?
- [ ] Check: Are transaction details stored? With what sensitivity?

### 4.3 Storage Access Control
- [ ] Verify no content script can directly access chrome.storage
- [ ] Verify storage keys are namespaced to prevent collisions
- [ ] Check for storage quota exhaustion attacks
- [ ] Audit storage migration logic (if any)

---

## Phase 5: Content Script & Extension Security (HIGH)
> *Goal: Verify the extension's injection doesn't create page-level vulnerabilities.*

### 5.1 Injection Mechanism
- [ ] Audit `inject()` utility — prototype pollution risk
- [ ] Verify `window.azguard` cannot be overwritten by page scripts
- [ ] Check `Object.defineProperty` usage — writable/configurable flags
- [ ] Audit script injection timing (`document_start` implications)
- [ ] Verify no DOM-based XSS in injected content

### 5.2 Manifest & CSP
- [ ] Audit all manifest permissions — are they minimal?
- [ ] Audit CSP policy — missing directives (object-src, frame-src)
- [ ] Verify COOP/COEP headers are correctly applied
- [ ] Check `wasm-unsafe-eval` scope and necessity
- [ ] Audit content script match patterns (`*://*/*` — intentionally broad?)

### 5.3 Extension Isolation
- [ ] Verify content scripts use appropriate isolation (main world vs isolated)
- [ ] Check for script-accessible extension resources (web_accessible_resources)
- [ ] Audit extension update/migration security
- [ ] Verify no extension pages are iframeable

---

## Phase 6: Service-by-Service Deep Dive (MEDIUM)
> *Goal: Audit each service for implementation quality, error handling, and edge cases.*

### Group A: Core Services (security-critical)
- [ ] **AccountService** — account CRUD, secret derivation, contract registration
- [ ] **ProfileService** — profile management, authentication, session handling
- [ ] **ExecutionService** — transaction construction, signing, submission
- [ ] **PxeService** — PXE lifecycle, secret forwarding, offscreen communication
- [ ] **RpcService** — method dispatch, parameter validation
- [ ] **DappSessionService** — session lifecycle, expiry, permissions
- [ ] **DappInteractionService** — permission enforcement, UI confirmation flow

### Group B: Financial Services (integrity-critical)
- [ ] **TokenService** — token metadata, transfer construction
- [ ] **TokenBalanceService** — balance queries, caching correctness
- [ ] **FpcService** — fee payment contract interaction
- [ ] **FaucetService** — testnet faucet requests (DoS potential)
- [ ] **NoteService** — note queries, privacy implications

### Group C: Support Services (quality-critical)
- [ ] **NetworkService** — node management, RPC endpoint validation
- [ ] **ConfigService** — stealth mode, config persistence
- [ ] **ContactService** — address book, input validation
- [ ] **TransactionService** — history, sync correctness
- [ ] **AuthRegistryService** — authorization witness management
- [ ] **TaskService** — background task lifecycle, cancellation
- [ ] **LoggerService** — log content sensitivity
- [ ] **LogViewerService** — log exposure risk
- [ ] **WalletConnectService** — WC protocol security
- [ ] **PasskeyService** — WebAuthn integration correctness
- [ ] **AccountStateService** — state query correctness

---

## Phase 7: UI & Frontend Security (MEDIUM)
> *Goal: Verify the popup UI doesn't introduce client-side vulnerabilities.*

- [ ] Audit Vue component input handling — XSS in user-supplied data
- [ ] Audit clipboard operations — sensitive data in clipboard
- [ ] Verify transaction confirmation UI cannot be spoofed
- [ ] Audit popup routing — can navigation bypass auth checks?
- [ ] Check Pinia store persistence — sensitive data in reactive state
- [ ] Audit external link handling (stealth mode bypass)
- [ ] Audit external image loading (stealth mode bypass, tracking pixels)
- [ ] Verify amounts/addresses displayed correctly (truncation attacks)

---

## Phase 8: Implementation Quality (LOWER PRIORITY)
> *Goal: Identify code quality issues that could lead to bugs or future vulnerabilities.*

- [ ] Error handling consistency across services
- [ ] Async/await correctness — unhandled rejections, race conditions
- [ ] Type safety — `any` usage, type assertions, unsafe casts
- [ ] Resource cleanup — event listener removal, port disconnection
- [ ] Memory management — large object retention, WeakRef usage
- [ ] Logging hygiene — no secrets in logs
- [ ] Test coverage assessment — critical paths tested?
- [ ] Dependency audit — known vulnerabilities in npm packages

---

## Preliminary Findings (from Phase 0 recon)

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| F-001 | CRITICAL | Password hashing uses single SHA-256 instead of PBKDF2 | `profile/service.ts:92` |
| F-002 | CRITICAL | No per-method authorization on RPC endpoint | `rpc/service.ts:38-60` |
| F-003 | CRITICAL | Content script injects into main world without isolation | `content-script/content.ts` |
| F-004 | HIGH | Session passhash stored in chrome.storage.session | `profile/service.ts:567-571` |
| F-005 | HIGH | Math.random() used for request IDs | `base/background/client.ts:131` |
| F-006 | HIGH | ECDH handshake has first-wins MITM gap | `messenger/client.ts:117-143` |
| F-007 | HIGH | Contract artifact/instance validation marked TODO | `rpc/utils.ts:232-234` |
| F-008 | HIGH | No origin binding in session-to-client event routing | `proxy/server.ts:18-49` |
| F-009 | HIGH | Silent error swallowing in message handler | `messenger/server.ts:134` |
| F-010 | MEDIUM | IV-derived salt in encryption (same IV = same key) | `encryption-key.ts:33` |
| F-011 | MEDIUM | No rate limiting on RPC endpoint | `rpc/service.ts` |
| F-012 | MEDIUM | Storage at rest is plaintext (except profile secrets) | `entity_storage.ts` |
| F-013 | MEDIUM | CSP missing object-src and frame-src directives | `manifest.config.ts` |

---

## How To Use This Plan

1. **Work phase by phase.** Each phase builds on understanding from prior phases.
2. **Check boxes as you go.** Each `[ ]` is a discrete audit task.
3. **Log findings in the table above** with severity, description, and file location.
4. **After each phase, write a summary** of findings and their combined risk.
5. **Phases 1-3 are critical** — complete these before moving to later phases.
6. **Phase 6 is the longest** — tackle Group A first, then B, then C.
