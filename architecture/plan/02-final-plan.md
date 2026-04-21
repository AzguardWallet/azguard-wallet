# Nulo Wallet — Modularization + Testability Plan (final draft)

_Consolidated from: Claude's notes (`my-notes/01-06`), codex's independent notes (`codex-notes/01-14`), and industry research (`research/mv3-wallet-state-of-the-art.md`). Subject to audit review before acceptance._

## Thesis

The codebase is not broken. It is coherent, reasonably modern, and recently polished. But critical flows are not restart-safe, key orchestrators are too big to test, and most business logic is trapped inside MV3 runtime code.

The path forward is **incremental surgery**, not a rewrite:

1. **Make the critical flows restart-safe** (MV3 is ephemeral; the wallet must assume that).
2. **Close the identified security gaps** (`createAuthWit` scope, passhash-as-bearer, popup-create failure paths).
3. **Introduce ports / composition root** so services become testable without a live browser runtime.
4. **Split the God services** behind those ports.
5. **Promote stable internal modules into workspace packages.**
6. **Production hardening last**, once reasoning is easy.

Architectural debt > TypeScript debt. We pay TS debt *only* when it defines a boundary.

## Guardrails (non-negotiable)

1. **Never break crypto invariants.** KDF labels (`nulo:kdf:v1`, `nulo:master:v1`, `nulo:profile:v1`), `AccountType.Nulo_v1 = 0`, AES-GCM ciphertext format `[version][12b IV][ct]`, passkey RP ID `nulo.sh`, `SchnorrAccountContractArtifact` pinning. Any refactor preserves these or rotates them explicitly with migration.
2. **Test harness first.** No production code change without a seam + test.
3. **Small, reversible commits.** Revert path documented in each PR message.
4. **Feature-flag big refactors.** Parallel-run old+new for one cycle on fee estimation, tx building, prove pipeline. Golden-file tests on real fixtures.
5. **Measure continuously.** Track: tests not needing `chrome.*` mocks, flows surviving SW restart, time-to-run critical e2e flows locally, singletons removed.

## Milestones at a glance

| Milestone | Goal | Duration |
|---|---|---|
| **M0 — Emergency fixes (~3 days)** | 4 small patches to close real gaps before we touch architecture | < 1 week |
| **M1 — Restart safety + composition root (~2 weeks)** | 7 PRs. Critical flows survive SW restart; composition root exists; popup singletons removed; first deterministic e2e harness | 2 weeks |
| **M2 — Ports + God-service splits (~3-4 weeks)** | Ports defined in `src/core/`; ProfileService + ExecutionService split; PxeService narrowed; contract tests on runtime edges | 3-4 weeks |
| **M3 — Internal package seams (~3 weeks)** | Stable modules promoted to Bun workspaces (`@nulo/wallet-core`, `@nulo/wallet-crypto`, etc.); cross-layer imports prevented by boundary | 2-4 weeks |
| **M4 — Production hardening (~3 weeks)** | Content-script scope review; session secret hardening; registry trust; CI release-grade; offscreen recoverability | 2-3 weeks |
| **M5 — Test coverage scale-up (continuous)** | Component tests, store tests, service contract tests, passkey e2e via virtual authenticator, mutation testing on critical dirs | ongoing |

---

## M0 — Emergency fixes (before architectural work)

Codex surfaced four items small enough to land this week, independent of the refactor.

| # | Fix | Evidence | Risk | Size |
|---|---|---|---|---|
| **M0.1** | Finish `createAuthWit` scope enforcement — validate `CallIntent.call.to` + `call.name` against the same scope model used by `sendTx`/`simulateTx`. Deny authwits exceeding granted scope. | `scope-enforcement.ts:192-204` | med | 1-2 days |
| **M0.2** | Popup creation failure paths reject the stored promise. Add hard timeout to all popup-backed approvals. Today, a failed `chrome.windows.create` early-returns without resolving the interaction/passkey promise. | `dapp-interaction/service.ts:173-195`, `passkey/service.ts:59-89` | low | < 1 day |
| **M0.3** | Make `buildAndEstimateTxRequest` side-effect free. Clone `op.actions` before `unshift`-ing fee payloads. | `execution/service.ts:1755/1793/1813` | low | hours |
| **M0.4** | Document the passhash session threat model in `SECURITY.md`. (Full remediation comes in M4.2 — this is just: explicit documentation of the current design, so future readers know). | `profile/service.ts:562-570` | low | hours |

**Exit:** 4 commits. Behavior preserved except for previously-stuck edge cases. No architectural moves yet.

---

## M1 — Restart safety + composition root (7 PRs, ~2 weeks)

Most critical work. Inspired by codex's PR 1-7. Mirror user-facing concerns: no hanging approvals, no silently-lost transactions, deterministic local e2e.

### M1.1 — Persist pending approval / passkey / task envelopes

**Change:** move request envelopes from in-memory `Map` to `chrome.storage.session` with TTL. Keep only resolver handles in memory. Popup can rehydrate by `requestId` after SW restart.

**Files:** `dapp-interaction/service.ts:40-41`, `passkey/service.ts:13`, `task/service.ts:31-32`.

**Tests:** service-level persistence + TTL; integration test that restarts SW mid-approval.

**Risk:** med. **Size:** 1-2 days.

### M1.2 — Durable pending-operation journal before proof generation

**Change:** create a durable operation record **before** proving starts. Drive it through `planned → proving → submitting → submitted → failed`. Popup renders from that record — no more assuming SW continuity. Reconcile final tx hash into the record once known.

**Files:** `execution/service.ts:305-343`, `popup/pages/send.vue:257-297`.

**Tests:** unit tests per state transition; integration test simulating SW restart mid-prove.

**Risk:** med. **Size:** 2-3 days.

**Candidate pattern** (from research): [XState](https://xstate.js.org/) actors serialized to `chrome.storage`. Adds ~30KB gz. Weigh vs hand-rolled state enum with a typed reducer. **Decision point in PR.**

### M1.3 — Introduce `src/core/` + first ports

Define minimal ports in `src/core/ports/`:

```ts
Clock { now(), sleep(ms), setInterval(fn, ms): Unsubscribe, setAlarm(name, at) }
BrowserApi { storage: StoragePort, runtime: RuntimePort, windows: WindowPort, alarms: AlarmsPort }
StoragePort { get, set, remove, onChange }
SessionStore { get<T>(key), set<T>(key, value), delete(key) }
```

Default implementations (`system-clock.ts`, `chrome-browser-api.ts`) wrap the real thing. Test fake: `@webext-core/fake-browser` (research recommendation — real in-memory storage state machine, not mocks).

**Size:** 2-4 days. **Risk:** low.

### M1.4 — Composition root for the service worker

**Change:** extract `createWalletRuntime(deps: RuntimeDeps): WalletRuntime` composition function. `src/wallet/index.ts` becomes a thin shell: construct `RealChromeApi + SystemClock` etc., pass into `createWalletRuntime`. Heartbeat loop moves behind a started/stopped runtime handle.

**Files:** `src/wallet/index.ts:34-126`, `src/wallet/base/index.ts:25-45`.

**Tests:** unit tests that construct the runtime with `FakeBrowserApi + MockClock`; startup test asserts deterministic registration order.

**Risk:** med. **Size:** 2-3 days.

### M1.5 — Remove popup-global service singletons

**Change:** replace `src/utils/core.js` `managers` global with an explicit `AppServiceContext` created at popup boot. Stores + composables consume injected clients. Backward-compat shim for one release cycle.

**Files:** `src/utils/core.js:14-59`, `src/popup/app.vue:42-260`.

**Tests:** component tests with injected fake clients; popup + sidepanel boot tests.

**Risk:** med. **Size:** 2-3 days.

### M1.6 — Explicit service startup ordering

**Change:** replace `Promise.all(services.start())` with explicit phase graph:
- Phase 0: Config, Logger
- Phase 1: Profile, Network, Passkey
- Phase 2: Account, Contact, DappSession, Task
- Phase 3: Transaction, Token, Fpc, AuthRegistry, AccountState, Note
- Phase 4: TokenBalance, Execution, DappInteraction, LogViewer

Drop the 30s `ensureInitialized()` poll in base classes (keep as temporary fallback with lint warning during migration).

**Tests:** startup ordering is now deterministic, tests assert the phase contract.

**Risk:** med. **Size:** 2 days.

### M1.7 — Deterministic local e2e harness for the three critical flows

**Change:** stop depending on skipped external dApp tests as bridge signal. Add a local dApp fixture. Make three flows first-class smoke scenarios: (a) cold-start register, (b) unlock + send, (c) dApp sendTransaction. Stabilize selectors + fixture bootstrap (arc 11 already moved loader waits to `[data-testid="global-loader"]`).

**Files:** `tests/e2e/connect-dapp.test.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/fixtures/extension.ts`.

**Tests:** the PR is the tests.

**Risk:** med. **Size:** 2-4 days.

### M1 exit criteria

- Approval / passkey / send flow survives SW restart without becoming unrecoverable.
- Three critical flows run in deterministic e2e against local fixtures (green).
- New unit tests don't need to mock `chrome.*` globally to exercise core logic.
- `createAuthWit` security gap closed (from M0.1).
- Popup singletons removed.

---

## M2 — Ports + God-service splits (~3-4 weeks)

### M2.1 — Split `ProfileService`

**Targets:**
- `ProfileRepository` — CRUD over `nulo:core:profiles`.
- `SessionManager` — session lifecycle, TTL via `chrome.alarms` (research: survive SW restart).
- `PasswordSecretBox` — PBKDF2 + AES-GCM encrypt/decrypt, passhash semantics.
- `PasskeyRecoveryCoordinator` — WebAuthn PRF + HKDF derivation, credential registration.

Evidence: `profile/service.ts:531-570` (session restore mixes decryption + lifecycle).

**Risk:** med. **Size:** 1 week.

### M2.2 — Split `ExecutionService`

**Targets:**
- `OperationPlanner` — normalize incoming operations → pipeline input.
- `FeeStrategy` interface + 4 implementations (FJ, FJWC, FPC, Embedded). Each testable with fake node + PXE port.
- `ContractResolver` — local PXE → known → registry cascade (moved from PxeService).
- `TxRequestBuilder` — payload assembly + `account.buildTxExecutionRequest`.
- `ExecutionCoordinator` — wraps the pipeline; acquires durable operation (from M1.2).
- `AuthwitDiscoverer` — extracted authwit logic.
- `ExecutionFacade` — thin RPC-facing service; delegates to coordinator.

**Feature-flag** the new pipeline. Parallel-run old+new for one release cycle. Golden-file tests on real fixtures.

**Risk:** high. **Size:** 1-2 weeks.

### M2.3 — Narrow `PxeService`

**Targets:**
- `ChainRuntime` — per-chain PXE + node + dataDir, concurrency de-dupe.
- `ArtifactRegistry` — cascade strategy explicit; registry pinning + content verification.
- `PxeProcessSupervisor` — offscreen lifecycle only. Move `ensureOffscreenRunning()` from `PxeServiceClient` call sites into the offscreen transport base.
- `CleanupManager` — profile-delete + orphan PXE DB cleanup.

**Finish `ReadWriteGuard`** (real reader counting + drain) in the same arc.

**Risk:** high. **Size:** 1-2 weeks.

### M2.4 — Contract tests on runtime edges

Focused tests that lock down Nulo's wire contracts:
- popup ↔ SW RPC (request/response shapes, reconnect behavior).
- SW ↔ offscreen (timeout, keepalive, zombie kill).
- content-script bridge envelope parsing.

Not testing Chrome. Testing *our contract*.

**Risk:** med. **Size:** 3-5 days.

### M2 exit criteria

- High-value policy logic runs in pure unit tests.
- `ProfileService`, `ExecutionService`, `PxeService` are façades over smaller modules.
- Runtime edges have explicit contracts + tests.

---

## M3 — Promote stable seams into packages (~2-4 weeks)

Once internal boundaries exist in `src/core/`, promote stable ones to Bun workspaces. Inspired by `@metamask/core` monorepo structure.

**Extraction order:**

1. `@nulo/wallet-core` — pure TS domain (ports, types, pure policy). No browser deps. **Testable in Node.**
2. `@nulo/wallet-crypto` — KDF labels, `EncryptionKey`, `PasskeyCredential`, key derivation, zeroization helpers.
3. `@nulo/extension-messaging` — `Service` / `ServiceClient` base classes, Zod schemas (from M2), structured errors.
4. `@nulo/aztec-runtime` — PXE, NuloAccount adapter. Extract **only after** ExecutionService split; otherwise the God class just changes package.
5. `@nulo/wallet-bridge` — facade around `@aztec/wallet-sdk` so upstream churn is isolated to one module.
6. `@nulo/extension-ui` — Vue 3 components + composables. **Last.** Only once `AppServiceContext` is stable.
7. `@nulo/extension` — the MV3 glue that wires all of the above.

**Size:** 2-4 weeks across 7 extractions. **Risk:** med per extraction.

**Exit:**
- Browser runtime code can't import deep domain modules directly.
- Pure modules consumable in unit tests without MV3 or Vue.
- Cross-layer imports prevented at package level.

---

## M4 — Production hardening (~2-3 weeks)

| # | PR | Risk | Size |
|---|---|---|---|
| **M4.1** | Content-script scope review. Today `*://*/*` all_frames `document_start`. Keep broad match only if explicit product req; otherwise move to dynamic registration for known dApp sessions. Minimize static content-script code. Hostile-frame tests. | med | 3-7 days |
| **M4.2** | Harden session secret: stop persisting raw `passhash` as bearer. Replace with device-local session key (wrapped secret), or re-auth on SW restart. Product decision gate. | high | 4-7 days |
| **M4.3** | Registry trust: validate fetched artifacts deterministically against requested class id. Pin registries in config with env-aware allowlists. Content-address verification if registry is production-trust. | med | 2-4 days |
| **M4.4** | Offscreen lifecycle observable + recoverable. Request ids with terminal status telemetry. Define idempotent PXE actions vs those requiring compensation. Health signals exposed. | med | 3-5 days |
| **M4.5** | Proactive TTL via `chrome.alarms` + `lockedAt` in `chrome.storage` (research: rehydrate `isLocked` on every SW wake). Replace reactive `_getSession()` check. | low-med | 1 day |
| **M4.6** | Best-effort zeroization on decrypted secret + passhash buffers. Accept GC timing caveat. | low | hours |
| **M4.7** | Passkey session symmetry — either `restorePasskeySession()` (re-prompt for PRF on SW restart) or explicit doc that passkey ≠ password for session durability. | med | days |
| **M4.8** | RP ID contract: make it an explicit build-time constant. Gate prod builds so RP ID + host_permissions match. Document migration implications. | med | 1-2 days |
| **M4.9** | Same-chain-different-RPC PXE isolation (codex R11). PXE data dir is keyed `${profileId}/${chainId}` — variants share state across RPC endpoints. Key by `profileId/chainId/rpcUrlHash`, or fail fast on mismatched endpoints. | med | 2-3 days |
| **M4.10** | Per-collection schema migrations instead of destructive global wipe. Each `EntityStorage` knows its own version + up-migration. | med | weeks |
| **M4.11** | **(Deferred/aspirational)** Encrypt profile-scoped metadata at rest (contacts, dApp sessions, tokens, tx history). Per-profile key from master secret. Large. | high | weeks |

**Exit:**
- CI release-grade: unit + integration + local e2e gates reliable.
- Extension can explain or recover from worker/offscreen restarts.
- Trust boundaries around secrets, registry data, page injection are explicit.

---

## M5 — Test coverage scale-up (continuous)

| # | PR | Risk | Size |
|---|---|---|---|
| **M5.1** | Vue component tests via `@vue/test-utils` + jsdom. Pilot: Button, Input, LoadingState, Banner, Toggle. | low | days |
| **M5.2** | Pinia store tests. app, popup, cache, notification. | low | day |
| **M5.3** | Service contract tests — each `spec.ts` drives a fixture that exercises client ↔ service against `@webext-core/fake-browser`. | med | weeks |
| **M5.4** | **Evaluate** Puppeteer → Playwright. Research: both work for MV3. Migrate only if Puppeteer harness actively hurts. | med | 1 week |
| **M5.5** | Virtual WebAuthn authenticator via CDP `WebAuthn.addVirtualAuthenticator`. Enables deterministic passkey e2e. | med | days |
| **M5.6** | Coverage via c8. Target: >60% overall, >80% on `wallet/services/**`. Publish on PR. | low | day |
| **M5.7** | Stryker mutation testing, incremental mode, on `wallet/services/{account,transaction,profile,execution}/**` only. Research: only worth it on critical paths. | med | 1 week |

---

## Process: quality gates that accrete

| After milestone | New gate in CI |
|---|---|
| M0 | Pre-commit lint (already there) |
| M1 | `bun run test` + `bun run typecheck` on PR (green required); e2e smoke on PR |
| M2 | Coverage threshold on `wallet/services/**` (start: 50%, ratchet up) |
| M3 | Package boundary checker (no cross-package imports except through index) |
| M4 | Release-gate CI: unit + integration + e2e + coverage + boundary check |
| M5 | Mutation coverage on critical dirs; virtual-authenticator passkey e2e |

---

## Risk register (ranked — codex R1-R11 + my additions)

| ID | Risk | Severity | Addressed in |
|---|---|---|---|
| R1 | `createAuthWit` scope incomplete | **high** (security) | M0.1 |
| R2 | `passhash` stored as bearer | **high** (security) | M4.2 (product decision gate) |
| R3 | Approval / passkey / task ephemeral (SW restart lossy) | **high** | M1.1 |
| R4 | Content script injected on every page / frame / document_start | **high** (attack surface) | M4.1 |
| R5 | In-flight tx not durably recorded until after `sendTx` | **high** | M1.2 |
| R6 | Public contract registry = trust root when enabled | med | M4.3 |
| R7 | Popup create failure leaves promises unresolved | med | M0.2 |
| R8 | Offscreen responses silently lost on SW mid-response | med | M4.4 |
| R9 | Implicit service startup order | med | M1.6 |
| R10 | Passkey RP ID hardcoded | med | M4.8 |
| R11 | Same-chain RPC variants share PXE data dir | med | M4.9 |
| + | `ReadWriteGuard` reads don't drain during writes | med | M2.3 |
| + | PXE sync state implicit | med | M2.3 or M4.4 |
| + | `buildAndEstimateTxRequest` mutates `op.actions` | low | M0.3 |
| + | Reactive TTL (secret lives past timeout) | med | M4.5 |
| + | No zeroization | low | M4.6 |

---

## Non-goals (explicit)

- No Vue rewrite.
- No Pinia rewrite.
- No Bun → npm/yarn migration.
- No immediate workspace explosion (M3 is incremental).
- No "fix all `any`" pass.
- No Aztec SDK pin bump.
- No brutalist UI revisit (arc 11 landed the vocabulary).

---

## What I measure

- Number of pure unit tests not requiring `chrome.*` mocks (target: >100 by M2 exit).
- Number of flows surviving SW restart (target: all three critical flows by M1 exit).
- Ratio of popup modules importing singleton clients (target: 0 by M1 exit).
- Services constructable with fake ports in isolation (target: 15 of 20 by M2 exit).
- Time to run three critical e2e flows locally (target: < 3 min by M1 exit).
- Coverage on `wallet/services/**` (target: 80% by M3 exit).

---

## Open questions for user

1. `session.passhash` — intentional UX (survive SW restart), or tighten? (Blocks M4.2; M0.4 lands documentation regardless.)
2. Content-script scope — product calls for broad `*://*/*` injection, or OK to narrow to known dApps? (Blocks M4.1 final shape.)
3. XState adoption for tx journal (M1.2 candidate pattern) — or hand-rolled state reducer?
4. Playwright migration (M5.4) — go/defer?
5. Package extraction (M3) — in-arc or defer?
6. Encrypted metadata at rest (M4.11) — priority or aspirational?
7. Are passkey-only profiles expected to survive SW restart seamlessly, or is re-prompt acceptable?

---

## Execution order (staffing one engineer)

**Week 1:** M0 (all 4 patches) + M1.1 (persist approvals) + M1.2 (durable journal).
**Week 2:** M1.3 (ports) + M1.4 (composition root) + M1.7 (e2e harness).
**Week 3:** M1.5 (remove singletons) + M1.6 (startup order). **M1 done.**
**Weeks 4-5:** M2.1 (ProfileService split) + contract tests start.
**Weeks 6-7:** M2.2 (ExecutionService split, feature-flagged).
**Weeks 8-9:** M2.3 (PxeService narrow) + M2.4 (contract tests wrap). **M2 done.**
**Weeks 10-12:** M3 extractions start (core, crypto, messaging first).
**Weeks 13-14:** M4 hardening (content-script, session secret, registry).
**Ongoing:** M5 test coverage.

Revisit pacing every 2 milestones.
