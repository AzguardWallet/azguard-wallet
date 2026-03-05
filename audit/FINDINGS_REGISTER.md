# Findings Register — Azguard Wallet Security Audit

**Branch:** `wallet-sdk-integration`
**Date:** 2026-03-05

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 8 |
| LOW | 10 |
| **Total** | **22** |

> INFO-level findings (design notes, no action required) are documented in the phase files but omitted from this register.

## All Findings

| ID | Severity | Title | Phase | Primary File |
|----|----------|-------|-------|-------------|
| F-P7-01 | **CRITICAL** | Clipboard not cleared after seed/key export | 7 | `src/popup/pages/settings/security/export/seed.vue` |
| F-P1-03 | **HIGH** | Math.random() for request IDs | 1 | `src/wallet/base/background/client.ts` |
| F-P3-01 | **HIGH** | Empty methods list grants blanket dApp access | 3 | `src/wallet/services/dapp-interaction/service.ts` |
| F-P6-01 | **HIGH** | Lock force-release race condition | 6 | `src/wallet/utils/lock.ts` |
| F-P3-03 | MEDIUM | 7-day session TTL without revocation UI | 3 | `src/wallet/services/dapp-session/service.ts` |
| F-P4-01 | MEDIUM | Plaintext storage of sensitive metadata | 4 | `src/wallet/storage/entity_storage.ts` |
| F-P4-03 | MEDIUM | Password hash in session storage | 4 | `src/wallet/services/profile/service.ts` |
| F-P5-01 | MEDIUM | Content script injected on all pages | 5 | `manifest/manifest.config.ts` |
| F-P5-04 | MEDIUM | Web-accessible resources exposure | 5 | `manifest/manifest.config.ts` |
| F-P7-04 | MEDIUM | Pinia state not cleared on wallet lock | 7 | `src/stores/app.store.ts` |
| F-P1-01 | LOW | SHA-256 pre-hash before PBKDF2 | 1 | `src/wallet/services/profile/encryption/encryption-key.ts` |
| F-P1-02 | LOW | IV/salt deterministic coupling | 1 | `src/wallet/services/profile/encryption/encryption-key.ts` |
| F-P2-04 | LOW | No popup↔background request timeout | 2 | `src/wallet/base/offscreen/client.ts` |
| F-P2-05 | LOW | No schema validation on messages | 2 | `src/wallet/utils/serialization.ts` |
| F-P3-04 | LOW | No schema validation on DappPermissions | 3 | `src/wallet/services/dapp-session/service.ts` |
| F-P6-02 | MEDIUM | Token balance worker — no backoff on failure | 6 | `src/wallet/services/token-balance/service.ts` |
| F-P6-04 | LOW | Unsafe ABI decode fallback (`as any`) | 6 | `src/wallet/services/execution/service.ts` |
| F-P6-05 | LOW | FPC discovery double-check race | 6 | `src/wallet/services/fpc/service.ts` |
| F-P7-02 | MEDIUM | No URL protocol validation for external links | 7 | `src/composables/externalLinks.ts` |
| F-P7-03 | LOW | dApp logo URL not validated | 7 | `src/composables/externalImage.ts` |
| F-P8-01 | LOW | Unused insecure getRandomElement() | 8 | `src/wallet/utils/random.ts` |
| F-P8-02 | LOW | Silent error swallowing in decrypt queue | 8 | `src/wallet/services/wallet-sdk/background.ts` |

> Note: F-P8-03 (monkey-patch fragility), F-P8-04 (as any in dispatcher), F-P8-05 (popup timeout), F-P8-06 (async correctness) are documented in phase files but classified as LOW/INFO and omitted from the register for brevity. F-P2-03 is a cross-reference to F-P1-03.

## Top 10 Recommended Fixes

| Priority | Finding | Effort | Fix |
|----------|---------|--------|-----|
| 1 | F-P7-01 | Small | Clear clipboard on unmount + 30s timer |
| 2 | F-P1-03 | Small | Replace `Math.random()` with `crypto.getRandomValues()` in 2 files |
| 3 | F-P3-01 | Medium | Validate methods array in `checkMethodPermission` or require non-empty |
| 4 | F-P6-01 | Medium | Return AbortSignal from lock.enter() or poison lock on force-release |
| 5 | F-P7-04 | Small | Add lock listener to Pinia stores to clear state |
| 6 | F-P7-02 | Small | Validate URL protocol before `window.open()` |
| 7 | F-P3-03 | Medium | Add session management UI + shorter default TTL |
| 8 | F-P4-03 | Medium | Hash the passhash before storing in session storage |
| 9 | F-P6-02 | Small | Add exponential backoff to token balance worker |
| 10 | F-P5-04 | Small | Set `use_dynamic_url: true` in web_accessible_resources |

## Changes from Previous Audit (120 findings)

The previous audit ran on a stale branch. Key changes:

| Old Finding | Current Status |
|-------------|---------------|
| F-P1-01: Single SHA-256 password hashing | **Previous audit was wrong** — PBKDF2 600k was always present (since `59ea776`). SHA-256 is a pre-hash step, not the KDF. |
| F-P3-01: Lock deadlock (`enter` instead of `leave`) | **FIXED** — all locks use try/finally with `leave()` |
| F-P3-02: No dApp origin binding | **PARTIALLY FIXED** — wallet-sdk sessions use `tryGetDappSessionByOrigin()` |
| F-P2-01: Math.random() for request IDs | **STILL PRESENT** in 2 files |
| F-P2-02: No request timeout | **PARTIALLY FIXED** — offscreen has 90s timeout; popup↔background still none |
| Content script ECDH proxy | **REPLACED** — pure relay via `ContentScriptConnectionHandler` |
| RPC service method dispatch | **REPLACED** — `WalletSdkDispatcher` with explicit `METHOD_TO_KIND` map |

## File Cross-Reference

| File | Findings |
|------|----------|
| `src/wallet/base/background/client.ts` | F-P1-03, F-P2-03 |
| `src/wallet/base/offscreen/client.ts` | F-P1-03, F-P2-04 |
| `src/wallet/services/profile/encryption/encryption-key.ts` | F-P1-01, F-P1-02 |
| `src/wallet/services/profile/service.ts` | F-P4-03 |
| `src/wallet/services/dapp-interaction/service.ts` | F-P3-01 |
| `src/wallet/services/dapp-session/service.ts` | F-P3-03, F-P3-04 |
| `src/wallet/services/wallet-sdk/dispatcher.ts` | F-P3-02 (INFO), F-P8-04 |
| `src/wallet/services/wallet-sdk/background.ts` | F-P8-02, F-P8-03 |
| `src/wallet/services/execution/service.ts` | F-P6-04 |
| `src/wallet/services/token-balance/service.ts` | F-P6-02 |
| `src/wallet/services/fpc/service.ts` | F-P6-05 |
| `src/wallet/storage/entity_storage.ts` | F-P4-01 |
| `src/wallet/utils/lock.ts` | F-P6-01 |
| `src/wallet/utils/random.ts` | F-P8-01 |
| `src/wallet/utils/serialization.ts` | F-P2-05 |
| `src/composables/externalLinks.ts` | F-P7-02 |
| `src/composables/externalImage.ts` | F-P7-03 |
| `src/stores/app.store.ts` | F-P7-04 |
| `src/popup/pages/settings/security/export/seed.vue` | F-P7-01 |
| `src/popup/pages/settings/security/export/key.vue` | F-P7-01 |
| `manifest/manifest.config.ts` | F-P5-01, F-P5-02, F-P5-04 |
