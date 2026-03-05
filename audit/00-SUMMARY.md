# Phase 0: Architectural Mapping — Summary

**Status:** COMPLETE
**Date:** 2026-02-26
**Branch:** v4-devnet-2

---

## Deliverables

| Document | Description |
|----------|-------------|
| [00-trust-boundaries.md](./00-trust-boundaries.md) | All 6 trust boundaries mapped with transport, encryption, auth, and findings |
| [00-secret-lifecycles.md](./00-secret-lifecycles.md) | All 7 secrets traced from birth to death with exact code paths |
| [00-transaction-lifecycle.md](./00-transaction-lifecycle.md) | Complete transaction flow (dApp, UI, and connection) with security gates |
| [00-service-dependency-graph.md](./00-service-dependency-graph.md) | All 23 services, dependencies, storage keys, and event subscriptions |

---

## Key Architectural Observations

### 1. Well-Structured Service Architecture
The codebase follows a consistent pattern: each service has a `service.ts` (background), `client.ts` (UI), and `spec.ts` (typed contract). This provides compile-time safety and clean separation of concerns.

### 2. ProfileService is the Foundation
14 of 22 services depend on ProfileService. It controls authentication, session management, and secret access. This is the highest-value target for an attacker and the single point of failure for the wallet.

### 3. ExecutionService is the Hub
With 10 dependencies, ExecutionService orchestrates all transaction construction. Both dApp and UI flows converge here. Its correctness is critical for fund safety.

### 4. Privacy-First by Default
Stealth mode, disabled WalletConnect, disabled external images/links — the default configuration minimizes the attack surface and data leakage. This is excellent security posture.

### 5. Strong Cryptographic Foundation
ECDH P-521 for content script channel, AES-256-GCM for encryption, Poseidon2 for key derivation, Schnorr for signing. The cryptographic choices are sound.

---

## Phase 0 Findings Register

### Critical (2)

| ID | Finding | Location |
|----|---------|----------|
| F-S1-01 | Single SHA-256 for password hashing (no iterations, no salt) | `profile/encryption/encryption-key.ts:94-96` |
| F-S1-02 | Passhash (weak hash) stored in session storage | `profile/service.ts:567-571` |

### High (2)

| ID | Finding | Location |
|----|---------|----------|
| F-TA-01 | Silent execution path allows dApps to send transactions without UI when granted AccessLevel.Transactions | `dapp-interaction/service.ts:97-98` |
| F-B2-01 | No per-connection authentication on service ports (service name only) | `base/background/service.ts:39-47` |

### Medium (6)

| ID | Finding | Location |
|----|---------|----------|
| F-B1-01 | First-handshake-wins MITM gap in ECDH channel | `proxy/messenger/client .ts:117-126` |
| F-B2-02 | Weak request ID generation (Math.random) | `base/background/client.ts:128-132` |
| F-S2-01 | Encryption salt derived from IV (not independent) | `profile/encryption/encryption-key.ts:33` |
| F-S7-01 | dApp sessions stored plaintext in local storage | `dapp-session/service.ts:99` |
| F-S7-02 | Clock-based session expiry (manipulable) | `dapp-session/service.ts:175-190` |
| F-TC-02 | Confirmation level 5 grants full silent access (weak warning) | Connection popup |
| F-B5-01 | No node response authentication | `network/service.ts:287-299` |

### Low (6)

| ID | Finding | Location |
|----|---------|----------|
| F-B1-02 | No server authentication in ECDH handshake | Content script messenger |
| F-B5-02 | Address-to-IP correlation on node queries | Network/PXE services |
| F-B6-01 | Metadata leakage when WalletConnect enabled | WalletConnect service |
| F-S5-02 | Passkey credential metadata in profile storage | `passkey/credential.ts` |
| F-S7-03 | Bearer token model for dApp sessions | `dapp-session/service.ts` |
| F-TC-03 | 7-day session expiry with no re-auth | `dapp-session/service.ts:97` |

### Informational (6)

| ID | Finding | Location |
|----|---------|----------|
| F-B4-01 | Secrets cross boundary to offscreen PXE | PXE service |
| F-S2-02 | No explicit memory zeroing (JS limitation) | `profile/service.ts:511` |
| F-S3-01 | Account secret as protected class member | `azguard-v0-base.ts:54` |
| F-TA-03 | Transaction history stored plaintext | `execution/service.ts:485-495` |
| F-SD-01 | ProfileService is single point of failure | `wallet/index.ts` |
| F-SD-05 | 11 of 13 storage keys are plaintext | All services |

---

## Risk Heat Map

```
                    LOW IMPACT ◄─────────────────► HIGH IMPACT
                    │                                       │
HIGH LIKELIHOOD     │  F-S7-01  F-S7-02                     │  F-S1-01  F-S1-02
                    │  F-SD-05                              │
                    │                                       │
                    │                                       │
MEDIUM LIKELIHOOD   │  F-B2-02  F-B1-01                     │  F-TA-01  F-B2-01
                    │  F-S2-01                              │
                    │                                       │
                    │                                       │
LOW LIKELIHOOD      │  F-B6-01  F-S5-02                     │  F-B5-01
                    │  F-B1-02  F-TC-03                     │  F-B4-01
                    │                                       │
```

---

## Recommendations for Next Phases

### Phase 1 (Key Management) — Top Priority
- Deep-dive F-S1-01 and F-S1-02: Verify the actual attack vector and propose fix
- Verify `Fr.random()` entropy source
- Audit the full PBKDF2 → AES-GCM encryption pipeline
- Check if passkey PRF derivation has any gaps

### Phase 2 (Message Passing) — Top Priority
- Deep-dive F-B2-01: Map exactly what an attacker can do with a spoofed port connection
- Verify `jsonSanitize()` prevents prototype pollution
- Test ECDH handshake race condition practically

### Phase 3 (RPC & dApp Auth) — Top Priority
- Deep-dive F-TA-01: Map the complete silent execution attack surface
- Audit all `parseExecutionParams` validation gaps (known TODOs for artifact/instance)
- Verify session permission enforcement is complete

### Phases 4-8
- Follow dependency chain from critical findings above
- Storage encryption assessment (F-SD-05)
- Content script isolation review
- Service-by-service error handling
