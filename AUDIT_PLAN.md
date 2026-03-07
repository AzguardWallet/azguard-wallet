# Security Audit Plan — Azguard Wallet

**Branch:** `wallet-sdk-integration`
**Date:** 2026-03-05
**Scope:** Full codebase (src/, manifest/, vite config)

## Methodology

Static analysis of the Azguard Wallet Chrome extension (Manifest V3) for the Aztec network. The audit covers cryptographic primitives, message-passing architecture, dApp authorization, data-at-rest, extension hardening, service internals, frontend security, and implementation quality.

Each phase produces a findings document in `audit/` with severity ratings:

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Exploitable now; immediate fix required |
| **HIGH** | Significant risk; fix before production |
| **MEDIUM** | Defense-in-depth gap; fix in next sprint |
| **LOW** | Best-practice deviation; fix opportunistically |
| **INFO** | Observation or design note |

## Phase Checklist

| # | Phase | Document | Status |
|---|-------|----------|--------|
| 1 | Key Management & Cryptography | [`audit/01-key-management-crypto.md`](audit/01-key-management-crypto.md) | Done |
| 2 | Message Passing | [`audit/02-message-passing.md`](audit/02-message-passing.md) | Done |
| 3 | RPC & dApp Authorization | [`audit/03-rpc-dapp-authorization.md`](audit/03-rpc-dapp-authorization.md) | Done |
| 4 | Storage & Data at Rest | [`audit/04-storage-data-at-rest.md`](audit/04-storage-data-at-rest.md) | Done |
| 5 | Extension Security | [`audit/05-extension-security.md`](audit/05-extension-security.md) | Done |
| 6 | Service Deep Dive | [`audit/06-service-deep-dive.md`](audit/06-service-deep-dive.md) | Done |
| 7 | UI & Frontend Security | [`audit/07-ui-frontend-security.md`](audit/07-ui-frontend-security.md) | Done |
| 8 | Implementation Quality | [`audit/08-implementation-quality.md`](audit/08-implementation-quality.md) | Done |
| — | Master Register | [`audit/FINDINGS_REGISTER.md`](audit/FINDINGS_REGISTER.md) | Done |

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 3 |
| MEDIUM | 8 |
| LOW | 10 |
| **Total** | **22** |

INFO-level findings (design notes) are documented in phase files but omitted from the register.
