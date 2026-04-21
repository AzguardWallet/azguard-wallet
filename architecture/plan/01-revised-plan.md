# Modularization + Testability Plan — Revised v2

_Merges my-notes 01-06 + codex-notes 01-07 (codex still running; final merge after codex 08-14) + research/mv3-wallet-state-of-the-art.md._

## Philosophy

1. **Make the test harness first, then change code.** Industry consensus ([eyeo MV3 testing post](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension), [MetaMask core monorepo](https://github.com/MetaMask/core)) — wallet refactors without a safety net regress crypto paths.
2. **Small, reversible commits.** One PR = one concern. Revert-path documented.
3. **Low-risk easy wins first.** They accrete context and unblock later work.
4. **Never break crypto-bound invariants.** KDF labels (`nulo:kdf:v1` etc.), `AccountType.Nulo_v1 = 0`, passkey RP ID (`nulo.sh`), `SchnorrAccountContractArtifact` pinning, AES-GCM ciphertext format. Any migration preserves or explicitly rotates.
5. **Behavior-preservation over cleverness.** If a refactor changes timing / ordering / retry, flag it.
6. **Quality gates accrete.** Each phase adds CI coverage; never remove a gate.
7. **Borrow, don't reinvent.** MetaMask has shipped every hard problem we're about to hit. Use `@metamask/core` patterns where they fit; their messenger, their controller base class, their keyring-controller shape are load-bearing references.

## Near-term security patches (do first, out of band)

Codex flagged these during the read. They're tiny, high-impact, and independent of the refactor:

| # | Fix | Evidence | Risk | Size |
|---|---|---|---|---|
| S.1 | Finish `createAuthWit` scope enforcement | `scope-enforcement.ts:202` TODO — call target not validated when intent contains a call | **high** (security) | hours |
| S.2 | Document `session.passhash` threat model | `profile/service.ts:564` stores passhash base64 in session storage; functionally equivalent to unlocked secret for SW lifetime | high (clarity) | hours |
| S.3 | Make `buildAndEstimateTxRequest` side-effect free | `execution/service.ts:1755/1793/1813` mutates `op.actions` via `unshift` | med | hours |
| S.4 | Pin extension ID via manifest `key` | [Chrome docs on extension ID stability](https://developer.chrome.com/docs/extensions/reference/manifest/key) — RP ID `nulo.sh` is already fixed, but extension-ID-based fallback RP ID would need pinning | med | hours |

## Phase 0 — Foundation (no behavior change)

**Goal:** repeatable quality gates; clean dead code; commit docs.

| # | PR | Risk | Size |
|---|---|---|---|
| 0.1 | Delete dead code: `SimpleStorage`, `EntityStorage.getVersion/setVersion`, commented `setUninstallURL` in `wallet/index.ts:46`, dormant `src/setup/` (or document as reserved). Drop `host_permissions` if truly unreferenced after grep. | low | hours |
| 0.2 | `.js` → `.ts` sweep: `src/utils/core.js` + ~10 composables/utils. | low | days |
| 0.3 | Baseline typecheck. Fix trivially wrong; bulk-suppress 145+ Aztec SDK type-mismatches behind `known-ts-issues.md` + `// biome-ignore` + linked issue. Target: `bun run typecheck` exits 0. | low-med | days |
| 0.4 | Stabilize e2e: verify `[data-testid="global-loader"]` waits (already in arc 11), add SW warm-up fixture that uses `chrome.runtime.onInstalled`. Reference: [Puppeteer SW-termination recipe](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer). | low-med | day |
| 0.5 | Commit `/architecture/` to repo; link from root README. | low | hours |
| 0.6 | CI (GH Actions): `bun run lint && bun run typecheck && bun run test` on PR. `bun run test:e2e` nightly. | low | hours |
| 0.7 | LavaMoat `allow-scripts` at install (zero-risk supply-chain hardening). | low | hours |

**Exit:** green CI on every commit; architecture docs linked.

## Phase 1 — Ports & adapters (seams for testability)

**Goal:** formalize I/O boundaries so 80% of services become mockable without touching behavior. Take the ports-and-adapters pattern directly from MetaMask's core architecture.

| # | PR | Risk | Size |
|---|---|---|---|
| 1.1 | Define core ports: `ClockPort`, `StoragePort`, `MessagingPort`, `WindowPort`, `CryptoPort`, `NetworkPort`. Keep signatures minimal. Default implementations: `SystemClock`, `ChromeStorage`, `ChromeRuntimeMessaging`, `ChromeWindows`, `WebCryptoCrypto`, `AztecNodeClientFactory`. | low | days |
| 1.2 | Wire ports into **1 pilot service** (suggest `ContactService` — narrow domain). Build first unit test suite using [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation) — real in-memory state machine, not mocks. | low-med | day |
| 1.3 | Roll ports to remaining storage-only services (NetworkService, DappSessionService, TokenService, FpcService, TransactionService). Each = one PR with a tests file. | med | week (cumulative) |
| 1.4 | Rebuild `src/utils/core.js` → `src/utils/service-clients.ts`. Lazy factory, backward-compat shim 1 cycle. | med | day |
| 1.5 | Explicit service startup ordering (phase 0-4). Remove `ensureInitialized()` polling. | med | days |
| 1.6 | Extract `SessionContext` from `ProfileService` — services depend on read-only projection instead of event subscription. | med | days |

**Exit:** 6-8 services unit-testable; CI test count grows.

## Phase 2 — Wire format & messenger

**Goal:** runtime safety matches TS types; event streams converge on reconnect.

| # | PR | Risk | Size |
|---|---|---|---|
| 2.1 | Zod schemas at RPC boundary — pilot on `NetworkService` (both sides). Establish pattern. | med | days |
| 2.2 | Roll Zod to Config, Contact, DappSession, Fpc, AccountState. | med | weeks |
| 2.3 | Structured errors: `WalletError { code, message, details? }` replaces `getErrorMessage()` flattening. Classes: `UserRejectedError`, `ValidationError`, `NetworkError`. | med | days |
| 2.4 | Hard RPC timeouts + `AbortSignal` on worker calls (mirror offscreen's 90s pattern, per-method override). | med | days |
| 2.5 | Snapshot-with-subscribe pattern — `subscribe(h, {snapshotBefore:true})` emits state then streams. Pilot on `profileService.onActiveProfileChanged`, then roll. | med | weeks |
| 2.6 | **Evaluate** adopting [`@metamask/messenger`](https://github.com/MetaMask/core/tree/main/packages/messenger) as internal service-to-service bus. Replace direct `ExecutionService.imports[OtherService]` with messenger-mediated calls. | med-high | weeks |
| 2.7 | **Evaluate** [Comlink](https://github.com/GoogleChromeLabs/comlink) as a drop-in replacement for our custom port RPC. Likely not worth it — we already have lifecycle hooks — but document the decision. | decision | hours |

**Exit:** RPC contract machine-checked at runtime; UI reconnect converges.

## Phase 3 — God-service splits

**Goal:** `ExecutionService`, `PxeService`, `TokenBalanceService`, `ProfileService`, `DappInteractionService` become thin facades over testable collaborators.

| # | PR | Risk | Size |
|---|---|---|---|
| 3.1 | **ExecutionService split.** In order: (a) `OperationNormalizer`, (b) `ContractResolver` (cascade from PxeService), (c) `FeeStrategy` interface (FJ, FJWC, FPC, Embedded), (d) `TxRequestBuilder`, (e) `ProveAndSendExecutor`, (f) `AuthwitDiscoverer`. ExecutionService → orchestrator. Feature-flag the new path; parallel-run old+new one cycle; golden-file tests on real fixtures. | high | weeks |
| 3.2 | **PxeService split.** (a) `ChainRuntime` (per-chain PXE/node). (b) `ArtifactRegistry` (local+known+public). (c) `PxeProcessSupervisor` (offscreen lifecycle). Move `ensureOffscreenRunning` invariant into the transport base (codex recommendation). | high | weeks |
| 3.3 | **TokenBalanceService split.** (a) `BalanceRepository`, (b) `BalanceProjector`, (c) `BalanceJobQueue`. | med-high | week |
| 3.4 | **Durable pending interactions.** Persist `DappInteraction` + `PasskeyRequest` metadata to `chrome.storage.session`. On SW restart, popup recovers or shows "expired" cleanly. Candidate pattern: [XState](https://xstate.js.org/) actors serialized to storage. | med | days |
| 3.5 | **WindowManager** — only component that calls `chrome.windows.create/remove`. DappInteraction + Passkey route through it. Unblocks testability of both services. | low-med | days |
| 3.6 | **Shared CAIP resolution**: single module consumed by `dispatcher.ts` and `execute/index.vue` (codex flagged duplicated logic). | low | day |

**Exit:** the 5 refactor targets unit-testable; >70% coverage on orchestration.

## Phase 4 — Security & correctness

| # | PR | Risk | Size |
|---|---|---|---|
| 4.1 | Finish `ReadWriteGuard` — real reader counting + drain during writes. Add race tests (profile switch mid-read). | med | days |
| 4.2 | **Product decision** on `session.passhash`. Options: (a) keep + document explicitly, (b) re-auth token that can't decrypt secret, (c) prompt on every SW restart. Decision precedes the PR. | med-high | depends |
| 4.3 | Best-effort zeroization of decrypted secret + passhash `Uint8Array` after use. | low | hours |
| 4.4 | Proactive TTL via `chrome.alarms` + `lockedAt` in storage. Rehydrate `isLocked` on every SW wake (research recommendation). | low-med | day |
| 4.5 | Explicit PXE sync gating — `isSafeToProve(network): {ok, gap}` exposed. | med | days |
| 4.6 | Per-collection schema migrations — each `EntityStorage` knows its own version + up-migration. Deprecate destructive global wipe. | med | weeks |
| 4.7 | Symmetric passkey session — either add `restorePasskeySession()` using a non-crypto artifact (cache credentialId only, re-prompt for PRF), or document asymmetry explicitly. | med | days |
| 4.8 | **(Aspirational)** Encrypt profile-scoped metadata at rest (contacts, dApp sessions, tokens, tx history) with a per-profile key derived from master secret. **Large.** | high | weeks |

**Exit:** security review (next arc) has a narrower scope.

## Phase 5 — Test scale-up

| # | PR | Risk | Size |
|---|---|---|---|
| 5.1 | Vue component tests (`@vue/test-utils` + jsdom). Pilot: Button, Input, LoadingState, Banner, Toggle. | low | days |
| 5.2 | Pinia store tests. | low | day |
| 5.3 | Service contract tests — `spec.ts` → test fixture. Each method exercised client ↔ service with fake-browser. | med | weeks |
| 5.4 | **Evaluate** Puppeteer → Playwright. Better extension support, built-in tracing. Port existing suite. Research rates them "both work"; migrate only if Puppeteer harness is actively hurting us. | med | week |
| 5.5 | WebAuthn virtual authenticator via CDP `WebAuthn.addVirtualAuthenticator` — enables passkey e2e. | med | days |
| 5.6 | Coverage via c8. Target: >60% overall, >80% on `wallet/services/**`. | low | day |
| 5.7 | Stryker incremental mode on `wallet/services/{account,transaction,profile,execution}/**` only. Research: Stryker is only worth it on critical paths. | med | week |

**Exit:** red CI catches regressions most of the time.

## Phase 6 — Packaging

| # | PR | Risk | Size |
|---|---|---|---|
| 6.1 | Workspace packages: `@nulo/core` (pure TS domain + ports, no browser deps, testable in node), `@nulo/chrome-adapters`, `@nulo/pxe-adapter`, `@nulo/ui`, `@nulo/extension` (glue). Borrowed from [MetaMask/core monorepo](https://github.com/MetaMask/core). | high | weeks |
| 6.2 | Optional: a local `wallet-bridge` facade wrapping `@aztec/wallet-sdk` so upstream churn is isolated. | med | days |

## Sequencing

```
Security patches (S.1-S.4) — concurrent with Phase 0

Phase 0 ──┐
          ├─→ Phase 2 (hardening)
Phase 1 ──┤
          ├─→ Phase 3 (splits)
          └─→ Phase 4 (security)
                      │
                      └─→ Phase 5 (test scale-up)
                            │
                            └─→ Phase 6 (packaging)
```

Phases 0 + 1 start immediately. Phase 2 and Phase 3 can run in parallel once seams exist. Phase 4 follows Phase 3 test coverage. Phase 5 is continuous. Phase 6 is aspirational.

## Borrowed patterns (citations)

- **Ports & adapters with `@webext-core/fake-browser`** — [fake-browser](https://webext-core.aklinker1.io/fake-browser/installation), [eyeo MV3 testing](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension)
- **MetaMask controller architecture + messenger** — [@metamask/core](https://github.com/MetaMask/core)
- **`chrome.alarms` + `lockedAt` in storage for idle-lock** — [Chrome SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- **XState actors per tx, serialisable to storage** — [XState](https://xstate.js.org/), [Stately actors](https://stately.ai/docs/actors)
- **Extension-ID pinning via manifest `key`** — [manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- **CDP WebAuthn virtual authenticator** — [CDP WebAuthn domain](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)
- **LavaMoat `allow-scripts`** — [LavaMoat](https://github.com/LavaMoat/LavaMoat)

## Risks tracked

- **PR 1.5 (startup ordering)**: services may depend on concurrent start — keep `ensureInitialized()` as migration-period fallback with lint warning.
- **PR 3.1 (ExecutionService split)**: biggest refactor. Feature-flag, parallel-run, golden-file tests.
- **PR 4.2 (passhash)**: product decision required before code.
- **PR 4.8 (encrypted metadata)**: affects every read path; last.
- **PR 2.6 (messenger)**: evaluate before committing; may be overkill for 20-service graph.
- **PR 5.4 (Playwright migration)**: defer unless Puppeteer is actively painful.

## What this plan does NOT do

- Rewrite `@aztec/wallet-sdk` bridge (dependency).
- Change Vue 3 + Pinia + Vite + Bun stack.
- Change Aztec SDK pin (separate migration).
- Change brutalist UI vocabulary (arc 11 done).

## Open questions for user

1. `session.passhash` — intentional UX, or tighten?
2. Priority of 4.8 (encrypted metadata) vs Phase 5 (test scale-up)?
3. Messenger adoption (2.6) — go/no-go?
4. Playwright migration (5.4) — now or later?
5. Appetite for Phase 6 (packaging) in-arc, or defer?
6. Any feature work competing for cycles?
