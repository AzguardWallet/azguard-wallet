# Nulo Wallet — Modularization + Testability Plan (v3, post-audit)

_v2 audited by both codex (xhigh) and an independent general-purpose engineer. Both converged on: (1) sequencing bug — M1.3 ports must precede the restart-safety PRs; (2) M2.2 ExecutionService is under-sized; (3) M1 doesn't fix the underlying transport contract; (4) schedule was internally inconsistent; (5) first port surface was too shallow. All incorporated below._

## Thesis (unchanged)

- Incremental surgery, not rewrite.
- Restart-safety > cleanup > refactor > packaging > hardening.
- Architectural debt > TypeScript debt.
- Never break crypto invariants.

## Guardrails (unchanged — the immutable list)

Do not change without migration + test vectors:
- KDF labels `nulo:kdf:v1`, `nulo:master:v1`, `nulo:profile:v1`
- `AccountType.Nulo_v1 = 0` (embedded in Poseidon hash)
- AES-GCM ciphertext format `[version byte][12b IV][ct]`
- Passkey RP ID `nulo.sh`
- `SchnorrAccountContractArtifact` pinning

## Key audit-driven reorderings (v2 → v3)

1. **Ports + composition root + startup ordering become ONE coupled arc** (codex) — they all touch `wallet/index.ts` + `ServiceCollection.start()`. Land as M1-seed (first sub-arc of M1), before any restart-safety PR.
2. **First port surface expanded** (codex): was `Clock + BrowserApi + StoragePort`. Now adds `PxePort`, `NodeFactory`, `WindowPort`, `ApprovalPort`. These are the ports that actually unblock `ExecutionService`, `NetworkService`, `DappInteractionService`, `PasskeyService`.
3. **M2.2 ExecutionService split broken into 6 PRs + parallel-run PR** (both audits). Sized 3-5 weeks, not 1-2.
4. **M2.4 (popup↔SW + SW↔offscreen + content-script contract tests) moved to a foundational "runtime contract" PR in M1** (codex). Without it, M1.1/M1.2 ship assuming protocols they haven't hardened.
5. **Schedule ranges made range-only** (no false precision). Total realistic: **4-6 months** for a solo engineer.

## M0 — Emergency fixes + product decisions (≤ 1 week)

Parallel to everything else. No architectural work blocks on these.

| # | Item | Type | Size |
|---|---|---|---|
| M0.1 | Finish `createAuthWit` scope enforcement (`scope-enforcement.ts:192-204`). Reuse `checkTransactionCalls` pattern; extend `CallIntent` case. Expand `scope-enforcement.test.ts`. | **security patch** | 1-2 days |
| M0.2 | Popup-creation failure paths reject the promise; hard timeout on all popup-backed approvals. `dapp-interaction/service.ts:173-195`, `passkey/service.ts:59-89`. | reliability patch | < 1 day |
| M0.3 | Make `buildAndEstimateTxRequest` side-effect free — clone `op.actions` before `unshift`. Remove the defensive clone in the popup estimator (`execution/service.ts:373`) in the same commit. | purity patch | hours |
| M0.4 | **Documentation** (not emergency fix): write `SECURITY.md` section on `session.passhash` threat model. | doc | hours |
| M0.5 | **Product decisions needed before M1**: (a) Is broad content-script injection (`*://*/*`, `all_frames`, `document_start`) a hard requirement? (b) Is passkey-only profile SW-restart seamless survival a production requirement? (c) Golden-fixture source for M2.2 — captured sandbox txs, replayable local chain fixtures, or snapshot + replay? (d) Feature-flag mechanism — build-time define, storage flag, or dedicated system? | product/eng Qs | pre-kickoff |

## M1 — Foundation + restart safety (~3-4 weeks)

### M1-seed: ports + composition root + startup ordering (**one coupled arc — 1 PR arc, ~1.5 weeks**)

Addresses codex blocker #2 + ux-eng blocker #1.

**Change:** extract a pure `createWalletRuntime(deps: RuntimeDeps)` composition function. Define ports in `src/core/ports/`. Wire explicit startup phases. `src/wallet/index.ts` becomes a thin shell. `src/utils/core.js` → `src/utils/service-clients.ts` (typed).

**Ports introduced (not shallow):**

```ts
Clock                 { now, sleep, setInterval, setTimeout, setAlarm }
BrowserApi            { storage, runtime, windows, alarms, permissions }
  StoragePort         { get, set, remove, onChange }
  SessionStore        { get/set/delete scoped to chrome.storage.session }
  WindowPort          { create, onRemoved, close }  // used by passkey + dapp-interaction
  AlarmPort           { create, clear, onAlarm }    // used by proactive TTL
  RuntimePort         { sendMessage, onMessage, connect, onConnect }
PxePort               { ensureOffscreenRunning, proveTx, simulateTx, ... }
NodeFactory           { get(chainId, rpcUrl): AztecNode }
ApprovalPort          { createApproval(type, payload): Promise<Result> }
BackgroundTickerPort  { start(fn, intervalMs): Unsubscribe }  // for poll workers

AppServiceContext { profileClient, accountClient, networkClient, ... }  // popup-side
```

**Default implementations** wrap real Chrome APIs. **Test fake**: [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/) — real storage state machine, not vi.mock.

**Startup ordering — topological + cycle detection** (not just phase graph):
- Each service declares `dependencies: string[]` in its class.
- `ServiceCollection.start()` topologically sorts + detects cycles (fails fast with named error).
- Keep 30s `ensureInitialized()` fallback poll behind a migration lint-warning for one cycle.

**Popup-side:** `AppServiceContext` created at boot; stores + composables consume via DI. Backward-compat shim for one release cycle, with deprecation warning.

**Files:** `wallet/index.ts:34-126`, `wallet/base/index.ts:25-45`, `utils/core.js:14-59`, `popup/app.vue:42-260`, ~10 popup consumer files.

**Tests:** unit tests for composition with fake deps; topological sort + cycle detection; AppServiceContext injection.

**Size:** 1.5-2 weeks. **Risk:** med.

### M1-RT: runtime contract PR (**1 PR, ~1 week**)

Addresses codex blocker #3.

**Change:** harden the popup↔SW + SW↔offscreen + content-script transports *before* restart-safety features land on top:
- Hard per-method timeouts on `BackgroundServiceClient` (was 10s warn only).
- Structured errors (`WalletError { code, message, details? }`) replace `getErrorMessage()` string-flattening.
- Zod schemas at RPC boundary — pilot on `NetworkService`, establish pattern.
- Snapshot-with-subscribe event pattern for `profileService.onActiveProfileChanged` (others follow later).
- Contract tests: popup↔SW (request/response shape, reconnect), SW↔offscreen (uid, timeout, keepalive, zombie-kill), content-script bridge envelope parsing. Each ~2-3 days.

**Tests:** ~9 days across 3 protocols (ux-eng audit corrected the original 3-5 day estimate).

**Size:** ~1.5 weeks. **Risk:** med.

### M1.1: durable pending-operation journal (**1 PR, ~3-4 days**)

**Change:** create a durable operation record **before** proving starts. Drive `planned → proving → submitting → submitted → failed`. Popup renders from the record — no more 700ms navigate-away with continuity assumption. Persist to `SessionStore` port (M1-seed prereq). Reconcile tx hash on finalization.

**Decision point** (from M0.5 product Q): XState serialized to storage vs hand-rolled state enum. Default: **hand-rolled** (no new dep unless XState earns its weight on a later PR).

**Files:** `execution/service.ts:305-343`, `popup/pages/send.vue:257-297`. Popup listens to journal updates via snapshot-subscribe (M1-RT prereq).

**Subsumes "in-memory task maps"**: TaskService is already a nested task tree with retention — we **don't** wrap its envelope in session storage separately (codex should-fix). Journal owns the durable record; TaskService stays ephemeral for UI-only progress.

**Risk:** med. **Size:** 3-4 days.

### M1.2: persist pending approval + passkey envelopes (**1 PR, ~1-2 days**)

**Change:** `dapp-interaction/service.ts:40-41` + `passkey/service.ts:13` — move envelopes to `SessionStore`. Popup can rehydrate by `requestId` after SW restart. Only resolver handles stay in memory.

**⚠️ Passkey limitation** (ux-eng audit correction): restoring the envelope gives UX continuity but the session **master secret** doesn't come back; passkey profiles still need re-PRF on SW restart. Defer full symmetry to M4.8 (or move up per M0.5.b).

**Risk:** med. **Size:** 1-2 days.

### M1.3: deterministic local e2e harness for 3 critical flows (**1 PR, ~3-4 days**)

**Change:** local dApp fixture (stop depending on skipped external test). Smoke scenarios: register, unlock + send, dApp sendTransaction. Stabilize selectors (arc 11 did `[data-testid="global-loader"]`).

**Files:** `tests/e2e/connect-dapp.test.ts`, `global-setup.ts`, `fixtures/extension.ts`.

**Risk:** med. **Size:** 3-4 days.

### M1 exit criteria (revised)

- Approval window, passkey window, send flow can survive SW restart without leaking a pending promise.
  - **Caveat:** passkey profile master-secret still needs re-PRF unless M0.5.b says otherwise.
- Three critical flows run green in deterministic local e2e.
- Unit tests don't need global `chrome.*` mocks — they use `FakeBrowserApi` + injected ports.
- Popup singletons removed; `src/utils/core.js` → typed `service-clients.ts`.
- Service startup is deterministic (topological order, cycle-detected).
- Runtime contract at the three transports is hardened (timeouts, structured errors, pilot Zod).

**M1 realistic size:** 3-4 weeks (down from v2 optimistic "2 weeks").

---

## M2 — God-service splits (~6-10 weeks, not 3-4)

### M2.1 — Split `ProfileService` (~1 week)

Unchanged from v2. Targets: `ProfileRepository`, `SessionManager`, `PasswordSecretBox`, `PasskeyRecoveryCoordinator`.

### M2.2 — Split `ExecutionService` (**~3-5 weeks, staged; not 1 PR**)

Both audits flagged this. Split into sequence of mergeable PRs:

| PR | Extract | Est. |
|---|---|---|
| M2.2-a | `OperationPlanner` (normalize incoming ops) | 3-4 days |
| M2.2-b | `FeeStrategy` interface + 4 impls (FJ, FJWC, FPC, Embedded), each with unit tests | 1 week |
| M2.2-c | `ContractResolver` (pulled from both ExecutionService and PxeService) | 3-4 days |
| M2.2-d | `TxRequestBuilder` (payload assembly + account entrypoint call) | 3-4 days |
| M2.2-e | `AuthwitDiscoverer` (decouple from AuthRegistryService side-effect) | 3-4 days |
| M2.2-f | `ExecutionCoordinator` — wraps pipeline, owns journal updates (from M1.1) | 3-4 days |
| M2.2-g | Feature flag on the new pipeline + parallel-run + golden-fixture verification | 1-1.5 weeks |

**Feature-flag mechanism** (M0.5.d decision): build-time define for dev/e2e + a hidden config flag for staff testing.

**Golden fixtures** (M0.5.c decision): captured sandbox transactions, checked into `tests/fixtures/execution/`, diffed at assertion time.

### M2.3 — Narrow `PxeService` (~2 weeks)

- M2.3-a: `ChainRuntime` (per-chain PXE + node) — ~3 days
- M2.3-b: `ArtifactRegistry` with explicit policy (local → known → remote), registry pinning — ~3 days
- M2.3-c: `PxeProcessSupervisor` — move `ensureOffscreenRunning()` into offscreen transport base — ~2 days
- M2.3-d: **Finish `ReadWriteGuard`** — real reader counting + drain during writes. Own PR, own tests (race tests for profile switch mid-read). ~3 days

### M2.4 — Address worker-heavy services (new, codex audit correction)

v2 left these untouched. They block "services constructable with fake ports" exit criterion.

- M2.4-a: `TokenBalanceService` — separate `BalanceRepository`, `BalanceProjector`, `BalanceJobQueue` (uses `BackgroundTickerPort`). ~1 week.
- M2.4-b: `NetworkService` — `NodeFactory` port injection (not inline `createAztecNodeClient`). ~2 days.
- M2.4-c: `WindowManager` service — only thing calling `chrome.windows.create/remove`. DappInteraction + Passkey route through it. Unblocks both for unit test. ~2-3 days.

### M2.5 — Shared CAIP resolution module (~1 day)

Extract from `dispatcher.ts:732-760` + `execute/index.vue:135-156` — single source of truth.

### M2.6 — Crypto test vectors + regression suite (~2-3 days)

Prerequisite for M3 extraction #2 (ux-eng audit addition). Pin:
- PBKDF2 iterations × passhash × IV × secret → ciphertext (fixture)
- WebAuthn PRF × HKDF label × credentialId → master secret (fixture)
- Poseidon2([master, chainId, type, index]) → account secret (fixture)

Run before every M3 package boundary change.

**M2 realistic size:** 6-10 weeks. Both audits agreed v2's 3-4 weeks was wishful.

---

## M3 — Package extraction (~4-6 weeks, not 2-4)

Codex audit: "7 extractions + boundary enforcement + build-system wiring is build-system work, not just module moves." Corrected.

**Prerequisites:**
- M2.6 crypto test vectors pass on every boundary change
- Vite auto-import + component scanning config updated per-package
- `tsconfig.json` path aliases reworked
- Per-package `package.json` with Bun workspace wiring

**Extraction order** (unchanged):
1. `@nulo/wallet-core` — pure TS domain + ports
2. `@nulo/wallet-crypto` — KDF, encryption, zeroization. **Run M2.6 vectors before + after.**
3. `@nulo/extension-messaging` — `Service`/`ServiceClient` base + Zod schemas + structured errors
4. `@nulo/aztec-runtime` — PXE, NuloAccount adapter. Only **after** M2.2 done.
5. `@nulo/wallet-bridge` — facade around `@aztec/wallet-sdk`
6. `@nulo/extension-ui` — Vue components + composables
7. `@nulo/extension` — MV3 glue

**Boundary check:** add a lint rule (or dependency-cruiser) that fails if a package imports another package's internal path instead of its index.

---

## M4 — Production hardening (~3-4 weeks)

| # | PR | Risk | Size |
|---|---|---|---|
| M4.1 | Content-script scope review per M0.5.a decision | med | 3-7 days |
| M4.2 | Harden session secret (per M4.2 product decision) | high | 4-7 days |
| M4.3 | Registry trust — artifact class-id validation, env-aware pinning | med | 2-4 days |
| M4.4 | Offscreen recoverability — durable request ids, terminal status telemetry, idempotent action catalog | med | 3-5 days |
| M4.5 | Proactive TTL via `chrome.alarms` + `lockedAt` in storage | low-med | 1-2 days |
| M4.6 | Best-effort zeroization on decrypted secret + passhash buffers | low | hours |
| M4.7 | Per-collection schema migrations (kill destructive global wipe) | med | 1-2 weeks |
| M4.8 | Passkey session symmetry (full fix for M0.5.b if production req) | med | 3-4 days |
| M4.9 | RP ID build-time contract, match-check against manifest | med | 1-2 days |
| M4.10 | Per-RPC PXE isolation (`profileId/chainId/rpcHash` data dir) | med | 2-3 days |
| M4.11 | **(Deferred/aspirational)** Encrypted profile-scoped metadata at rest | high | weeks |

---

## M5 — Test scale-up (continuous, starts M1)

| # | PR | Risk | Size |
|---|---|---|---|
| M5.1 | Vue component tests pilot (Button, Input, LoadingState, Banner, Toggle) | low | days |
| M5.2 | Pinia store tests | low | day |
| M5.3 | Service contract tests — `spec.ts` drives fixture against `FakeBrowserApi` | med | weeks |
| M5.4 | Evaluate Puppeteer → Playwright (only if current harness actively hurts) | med | 1 week |
| M5.5 | Virtual WebAuthn authenticator via CDP | med | days |
| M5.6 | c8 coverage; gate on `wallet/services/**` (start 50%, ratchet) | low | day |
| M5.7 | Stryker incremental mutation testing on critical dirs **after** M2.2 (don't mutate God class) | med | 1 week |

---

## Quality gates that accrete

| After | Gate |
|---|---|
| M0 | Pre-commit lint + commit conv (existing) |
| M1-seed | `bun run test` + `bun run typecheck` on PR |
| M1-RT | Contract tests on three transports block merge |
| M1 exit | E2E smoke on PR; coverage tracked |
| M2 exit | Coverage threshold `wallet/services/**` (50%+) |
| M3 | Package boundary linter |
| M4 | Release-gate CI (all above + passkey virtual-auth e2e) |
| M5 | Mutation coverage on critical dirs |

---

## Revised realistic schedule (solo engineer)

| Phase | v2 (optimistic) | v3 (realistic) |
|---|---|---|
| M0 | < 1 week | < 1 week (+ M0.5 decisions pre-kickoff) |
| M1 | 2 weeks | **3-4 weeks** |
| M2 | 3-4 weeks | **6-10 weeks** |
| M3 | 2-4 weeks | **4-6 weeks** |
| M4 | 2-3 weeks | 3-4 weeks |
| M5 | continuous | continuous |
| **Total** | ~12-15 weeks | **~4-6 months** |

---

## Risk register (unchanged items from v2; additions below)

All R1-R11 from codex-notes/13 tracked, plus:

- **Schedule realism:** v2 under-estimated M2.2 + M3. v3 uses range-only estimates.
- **Packaging build-system work:** vite auto-import, component scanning, path aliases must all be ported per-package. Not just `mv files`.
- **Feature flag mechanism unfinalized:** default to build-time define + config flag. Revisit if rollout needs more.
- **Golden fixture source unfinalized:** default to captured sandbox txs. Revisit if determinism breaks.

---

## Open questions for user

Blockers to starting M1:
1. **(M0.5.a)** Is broad content-script injection `*://*/*` required by product, or can we narrow? Changes M4.1 scope substantially.
2. **(M0.5.b)** Are passkey-only profiles expected to survive SW restart seamlessly (production), or is re-PRF acceptable (beta)?
3. **(M0.5.c)** Golden-fixture source for M2.2 — sandbox capture, local chain replay, or TBD?
4. **(M0.5.d)** Feature-flag mechanism — OK with build-time define + config flag, or want a dedicated rollout system?
5. Staffing — one engineer solo, or is a second available for parallel M1/M2 work?
6. Is `session.passhash` intentional UX (survive SW restart) or tighten?
7. Priority: encrypted metadata at rest (M4.11) vs test coverage growth (M5)?

Non-blocking:
8. Playwright migration — now, later, or defer indefinitely?
9. XState dependency for M1.1 journal — default to hand-rolled unless you want XState's debugger.
10. Package extraction — full 7 packages, or start with just core/crypto/messaging?

---

## What this plan does NOT do (unchanged)

- Vue / Pinia / Vite / Bun rewrite.
- Aztec SDK pin bump.
- Brutalist UI revisit.
- Big-bang refactor.
- "Fix all `any`" pass.
