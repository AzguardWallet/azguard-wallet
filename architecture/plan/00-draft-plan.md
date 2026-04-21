# Modularization + Testability Plan — Draft v1

_Status: draft. Authored by Claude from my-notes/01-06 + codex-notes/01-05. To be cross-referenced with codex-notes/14-plan.md + audit feedback before acceptance._

## Guiding principles

1. **Make the test harness first, then change code.** Nothing moves without a seam + a test.
2. **Small, reversible commits.** One PR = one concern. Revert-path documented.
3. **Low-risk easy wins come first.** They accrete context, unblock later work, and build confidence.
4. **Never break crypto-bound invariants:** KDF labels (`nulo:kdf:v1` etc.), `AccountType.Nulo_v1 = 0`, passkey RP ID (`nulo.sh`), `SchnorrAccountContractArtifact` pinning, AES-GCM ciphertext format (`[version][iv][ciphertext]`). Any migration preserves or explicitly rotates.
5. **Behavior-preservation over cleverness.** If a refactor would change timing, ordering, or retry semantics, flag it.
6. **Quality gates accrete.** Each phase adds CI coverage; never remove a gate.

## Phase 0 — Foundation (no behavior change)

**Goal:** clean slate, working quality gates, repeatable typecheck/lint/test.

| # | PR | Risk | Size |
|---|---|---|---|
| 0.1 | Delete dead code: `SimpleStorage`, `EntityStorage.getVersion/setVersion`, commented `setUninstallURL` handler, dormant `src/setup/` entry (or document as reserved). Remove `host_permissions` if truly unused after grep. | low | hours |
| 0.2 | `.js` → `.ts` for `src/utils/core.js` (split eager singletons in 1.3), composables, utils, a few `.vue` scripts. Explicit types where inferred was broken. | low | days |
| 0.3 | Baseline the typecheck. Fix what's trivially wrong; bulk-suppress the 145+ Aztec-SDK-type-mismatch errors behind a `known-ts-issues.md` doc + `// biome-ignore` annotations with issue refs. Target: `bun run typecheck` exits 0. | low-med | days |
| 0.4 | Fix the e2e test flakes. Make SW-readiness wait structural (`[data-testid="global-loader"]` already landed in arc 11 — verify coverage for all 3 files). Add `chrome.alarms`-friendly SW warm-up fixture. | low | hours |
| 0.5 | Commit `/architecture/` to the repo + top-level README entry. Onboarding discoverability. | low | hours |
| 0.6 | Wire CI (GH Actions): `bun run lint && bun run typecheck && bun run test` on every PR. `bun run test:e2e` nightly. | low | hours |

**Exit criterion:** green CI on every commit; architecture docs linked from root README.

## Phase 1 — Seams (refactor-safe infrastructure)

**Goal:** inject the I/O boundaries. No service splits yet — just make them _injectable_.

| # | PR | Risk | Size |
|---|---|---|---|
| 1.1 | `Clock` abstraction. Interface: `now()`, `sleep(ms)`, `setTimeout`, `setInterval`, `setAlarm`. Default `SystemClock`. Inject into TaskService (60min TTL), TransactionService (1s worker loop), ProfileService (reactive TTL). | low | hours-day |
| 1.2 | `ChromeApi` interface. Thin typed wrappers over `chrome.runtime.*`, `chrome.storage.{local,session,onChanged}`, `chrome.windows.{create,onRemoved}`, `chrome.alarms`. Default `RealChromeApi`. Inject at service construction. Test fake: `FakeChromeApi` with in-memory storage + no-op messaging. | med | days |
| 1.3 | Rebuild `src/utils/core.js` → `src/utils/service-clients.ts`. Lazy factory: `getServiceClients(): ServiceClients`. Backward-compat shim for existing `managers.profile` imports (deprecation warning) for 1 cycle, then delete. | med | day |
| 1.4 | Explicit service startup ordering. Replace `Promise.all` in `ServiceCollection.start()` with phase tracking: `phase0: Config, Logger` → `phase1: Profile, Network, Passkey` → `phase2: Account, Contact, DappSession, Task` → `phase3: Transaction, Token, Fpc, AuthRegistry` → `phase4: TokenBalance, Execution, DappInteraction, AccountState, Note, LogViewer`. Drop `ensureInitialized()` polling from all services. | med | days |
| 1.5 | Extract `SessionContext` from `ProfileService`. Services depend on `SessionContext.getActiveProfile() / onProfileSwitch(cb)` instead of directly subscribing to `profileService.onActiveProfileChanged`. ProfileService still owns secret; SessionContext is a read-only projection. | med | days |
| 1.6 | Add first unit tests for refactored pieces: Clock, ChromeApi adapter, SessionContext. Each gets a spec. | low | day |

**Exit criterion:** ~8 services become unit-testable without `chrome.*` mocks.

## Phase 2 — Wire format (protocol hardening)

**Goal:** runtime safety catches up with TS types. RPC boundary becomes a real contract.

| # | PR | Risk | Size |
|---|---|---|---|
| 2.1 | Zod schemas at every method boundary for one pilot service (`NetworkService`). Request + response validated on both sides. Establish pattern. | med | days |
| 2.2 | Roll Zod boundary to 5 more services (Config, Contact, DappSession, Fpc, AccountState). Each PR = one service. | med | weeks (cumulative) |
| 2.3 | Structured errors: `{ code: string, message: string, details?: unknown }` replaces `getErrorMessage(e)`. Error classes: `WalletError`, `NetworkError`, `UserRejectedError`, `ValidationError`. Backward-compat stringified `.toString()` for legacy consumers. | med | days |
| 2.4 | Hard RPC timeouts + cancellation. Default 30s, override per method. `AbortSignal`-aware. Mirror offscreen's 90s pattern. | med | days |
| 2.5 | Snapshot-with-subscribe pattern for event streams. `subscribe(handler, { snapshotBefore: true })` — emits current state, then streams updates. Popup reconnect converges deterministically. Pilot on `profileService.onActiveProfileChanged`, then roll to all. | med | weeks |

**Exit criterion:** no RPC call can corrupt domain state via malformed payload; UI reconnect converges without manual `refresh()`.

## Phase 3 — God service splits (big moves)

**Goal:** the hard refactors. Prerequisites: Phases 0-2 shipped.

| # | PR | Risk | Size |
|---|---|---|---|
| 3.1 | **ExecutionService split.** Extract in order (each a PR): (a) `OperationNormalizer` (dispatch `SendTransactionOperation` vs. `AztecSendTxOperation` vs. utility/view ops). (b) `ContractResolver` (PXE + node + known-artifacts cascade — move from PxeService too). (c) `FeeStrategy` interface with 4 implementations (FJ, FJWC, FPC, Embedded). (d) `TxRequestBuilder` (payload assembly + `account.buildTxExecutionRequest`). (e) `ProveAndSendExecutor` (prove → toTx → send → persist). (f) `AuthwitDiscoverer` (move authwit logic out). ExecutionService becomes a thin orchestrator. | high | weeks |
| 3.2 | **PxeService split.** (a) `ChainRuntime` (per-chain PXE + node + dataDir). (b) `ArtifactRegistry` (local PXE + known + public registry strategy). (c) `PxeProcessSupervisor` (offscreen lifecycle only). PxeService becomes the facade. | high | weeks |
| 3.3 | **TokenBalanceService split.** (a) `BalanceRepository` (storage only). (b) `BalanceProjector` (pure computation). (c) `BalanceJobQueue` (scheduling + batching). Each independently testable. | med-high | week |
| 3.4 | **Durable pending approvals.** `DappInteractionService` + `PasskeyService` — persist pending requests to `chrome.storage.session` so SW restart doesn't drop them. User-visible: UI shows "Request expired" on timeout instead of silently losing them. | med | days |
| 3.5 | **Window management extraction.** `WindowManager` service — the only thing that calls `chrome.windows.create/remove`. DappInteractionService + PasskeyService route through it. | low-med | days |

**Exit criterion:** 5 refactor targets unit-testable; test coverage >70% on orchestration logic.

## Phase 4 — Security + correctness

**Goal:** close the identified correctness + security gaps.

| # | PR | Risk | Size |
|---|---|---|---|
| 4.1 | Finish `ReadWriteGuard` — real reader counting + drain during writes. Add tests for race cases (profile switch mid-read). | med | days |
| 4.2 | Revisit `session.passhash`. **Decision required first:** is this intentional UX (survive SW restart) or accidental? If intentional, document the threat model explicitly in `SECURITY.md`. If not, switch to a server-less re-auth flow where stored material can't decrypt the secret. | med-high | depends on product decision |
| 4.3 | Best-effort zeroization. Overwrite `Uint8Array` backing the decrypted secret + passhash after use. Accept GC-timing caveat. | low | hours |
| 4.4 | Proactive session TTL via `chrome.alarms`. Replace reactive `_getSession()` check. Alarm fires at `since + ttl`, triggers lock. | low-med | day |
| 4.5 | Explicit PXE sync gating. `PxeService` exposes `isSafeToProve(network): Promise<{ ok: boolean, gap: number }>`. ExecutionService (or its successor) gates prove calls. | med | days |
| 4.6 | Per-collection schema migrations. Replace the destructive global wipe with per-namespace migration functions. Each entity storage knows its own schema version + up-migration. | med | weeks |
| 4.7 | Encrypt profile-scoped metadata at rest — contacts, dApp sessions, token list, tx history. Key: derived from master secret per-profile. **Large, defer to last.** | high | weeks |

**Exit criterion:** a security audit (next arc) has a narrower scope.

## Phase 5 — Test infrastructure

**Goal:** we can say "this is tested" with confidence.

| # | PR | Risk | Size |
|---|---|---|---|
| 5.1 | Vue component tests via `@vue/test-utils` + jsdom. Pilot on Button, Input, LoadingState, Banner, Toggle. | low | days |
| 5.2 | Pinia store tests. app.store, popup.store, cache.store, notification.store. | low | day |
| 5.3 | Service contract tests. `spec.ts` becomes the test fixture: each spec method exercised client ↔ service with faked Chrome API. | med | weeks |
| 5.4 | Switch e2e from Puppeteer to Playwright. Built-in extension support, tracing, better debugging. Port existing suite. | med | week |
| 5.5 | WebAuthn virtual authenticator. Playwright supports it; enables passkey e2e. | med | days |
| 5.6 | Coverage reporting via c8. Publish on PR. Target: >60% overall, >80% on core services. | low | day |

**Exit criterion:** red CI catches regressions most of the time.

## Phase 6 — Packaging (aspirational)

_Not immediate. Revisit after phases 0-5._

- Split into workspace packages:
  - `@nulo/rpc` — transport primitives (`base/` today)
  - `@nulo/crypto` — key derivation, encryption, KDF labels
  - `@nulo/pxe-client` — offscreen PXE integration, artifact resolution
  - `@nulo/core` — services, domain models
  - `@nulo/extension` — MV3 glue, manifest, Vue UI
- Enables selective unit testing, publishing, and cross-app reuse (e.g. `@nulo/crypto` could power a web playground wallet).

## Sequencing summary

```
Phase 0 ──┐
          ├─→ Phase 2 (hardening)
Phase 1 ──┤
          ├─→ Phase 3 (splits)
          └─→ Phase 4 (security)
                      │
                      └─→ Phase 5 (test scale-up)
                            │
                            └─→ Phase 6 (packaging, later)
```

Phases 0 and 1 block nothing — start today. Phase 2 and Phase 3 run in parallel once seams exist. Phase 4 waits for the correctness work to have test support. Phase 5 grows continuously.

## Risk register

- **PR 1.4 (startup ordering)**: if services actually depend on `Promise.all`-style "start everything simultaneously" semantics (e.g. for cross-service lazy init), the phase graph I suggest could deadlock. Mitigation: keep `ensureInitialized()` as last-resort fallback with a migration-period lint warning.
- **PR 3.1 (ExecutionService split)**: this is the biggest refactor. Risk of regression in fee estimation (two-pass FPC), gas limit tuning, authwit discovery. Mitigation: feature-flag the new path, golden-file tests on real fixtures, parallel-run old + new for one cycle.
- **PR 4.2 (passhash revisit)**: product decision required. Don't touch before decision.
- **PR 4.7 (encrypted metadata)**: affects every read path. Schedule last. Consider keeping profile name + id plaintext so users can identify profiles while locked.

## What this plan does NOT do

- Doesn't rewrite the `@aztec/wallet-sdk` bridge or content-script behavior — external dependency, separate decision.
- Doesn't touch brutalist UI vocabulary (arc 11 landed the loading-state standard).
- Doesn't propose framework changes (Vue 3 + Pinia + Vite stay).
- Doesn't propose moving off Bun.
- Doesn't propose changing the Aztec SDK version pin — separate migration.

## Open questions for user

1. Is the password session design (passhash survives SW restart) an intentional UX tradeoff? If yes, we keep it and document; if no, Phase 4.2 escalates.
2. Priority of encrypted profile metadata (4.7) vs. test coverage growth (Phase 5)?
3. Appetite for switching e2e to Playwright (Phase 5.4) — meaningful risk, meaningful upside.
4. Any time pressure / feature work competing for attention that would push this to background cadence?

