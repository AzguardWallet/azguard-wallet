# Architecture Synthesis — Nulo Wallet Extension

_Consolidated from my own notes 01-05 + codex's independent notes 01-05 (as of 2026-04-20, 15 min into codex run)._

## 1. Runtime topology (authoritative)

Four execution contexts, three manifest-declared, one created at runtime:

| Context | Entry | Role | Lifetime |
|---|---|---|---|
| Service worker | `src/wallet/index.ts` | 19 privileged services, storage, all business logic | MV3: suspends after ~30s idle, revived on events/heartbeat |
| Popup / side panel / approval windows | `src/popup/index.ts` (one bundle, three shells) | Vue 3 UI | Closes on blur (popup); standalone for approval windows |
| Content script | `src/content-script/content.ts` | Thin relay; real bridge logic lives in `@aztec/wallet-sdk` | Per tab |
| Offscreen | `src/offscreen/index.ts` | Hosts PXE only (1 service) | Created lazily by SW, health-checked via PING/PONG |

**Two transports, shared type façade:**
- **UI ↔ SW**: long-lived `chrome.runtime.connect` port, per-service Port name, auto-reconnect, no hard request timeout (10s warn only), lost in-flight requests on SW restart.
- **SW ↔ Offscreen**: stateless `chrome.runtime.sendMessage`, uid-addressed, 90s timeout, 20s keepalive interval during long ops.

Wire format: JSON through `jsonSanitize()` (base64 Buffer, stringified bigint, flattened Map/Set). **Prototypes lost** — Zod rehydration only where callers remembered to add it.

## 2. Service inventory (20 services)

**Worker (19):** Config, Logger, LogViewer, Profile, Passkey, Network, Account, Contact, DappSession, DappInteraction, Task, Transaction, Token, TokenBalance, Fpc, AuthRegistry, AccountState, Note, Execution.
**Offscreen (1):** Pxe.

### Root services (things most depend on)
- **ProfileService** — master secret, active session, unlock; 12+ services subscribe to its events for scope. Acts as implicit "session context".
- **NetworkService** — per-chain AztecNode cache, seeds defaults
- **AccountService** — deterministic derivation, wraps Schnorr account
- **TaskService** — in-memory progress tree, consumed by UI

### God services (refactor candidates)
1. **ExecutionService** — 10 direct service deps, 2000+ LOC. Owns: operation normalization, contract registration, fee strategy, tx request build, prove/send, authwit discovery, gas balance cache, tx history projection, utility/view simulation.
2. **TokenBalanceService** — 7 deps, runs a background batching worker, mixes materialized-read-model storage + task UX + job queue + simulation.
3. **PxeService** (offscreen) — mixes process lifecycle + per-chain cache + artifact resolution + known-artifacts catalog + registry policy + cleanup-on-profile-delete.
4. **DappInteractionService** — 5 deps, opens popup windows directly via `chrome.windows.create` (untestable), ephemeral pending-request map.
5. **ProfileService** itself — session store + crypto + unlock + session restore + profile CRUD + master-secret reference.

## 3. Persistence layer

**Three wrappers** (`src/wallet/storage/`):
- `EntityStorage<T>` — `root@id` prefix-scan KV. Plaintext JSON, no schema, no indexes, no transactions.
- `ValueStorage<T>` — single JSON value.
- `SimpleStorage<T>` — **dead code** (not imported anywhere).

**Namespaces (14 keys):**
- Local (plaintext, persistent): profiles (partial plaintext + encrypted secret), networks, accounts, contacts, dapp sessions, tokens, token-balances, txs, auth-registry, auth-registry-enabled, fpcs, storage-version, config.
- Session (cleared on SW termination): `nulo:core:session`.

**Encryption boundary** is only `profile.secret` and `profile.guard` (AES-GCM via PBKDF2-SHA256 600k iterations). All other profile-scoped metadata (contacts, dApp sessions, tokens, tx history) is **plaintext at rest**.

**Migration** is destructive: on storage-version mismatch, wipes accounts + txs + tx-cursors + token-balances + PXE IndexedDB. Profiles + passkey credentials preserved. Per-collection versioning API (`EntityStorage.getVersion/setVersion`) is **dead surface** — not called anywhere.

## 4. Session + crypto boundaries

### Password profiles
- Password → SHA-256(password) = `passhash`
- `passhash` → PBKDF2-SHA256 (600k) = base key
- Base key + random IV + salt=SHA-256(IV) → AES-GCM encryption of 32-byte random secret
- Verification via decrypting a stored "guard" sentinel.
- **`passhash` written to `chrome.storage.session`** on unlock. This makes password sessions **recoverable across SW restart** — service `init()` re-decrypts.

### Passkey profiles
- WebAuthn PRF output (label `"nulo:profile:v1"`) → HKDF (salt = SHA-256(`"nulo:kdf:v1"` || credentialId), info = `"nulo:master:v1"`) → 32 bytes → `Fr.fromBufferReduce`
- **No `restorePasskeySession()`** — passkey sessions **die with the SW**.
- RP ID = `"nulo.sh"` hardcoded. Changing it = all passkeys lost (crypto-bound).
- Labels `"nulo:*:v1"` are KDF domain separators. **Changing them = lost keys.**

### Session timeout
- Default 30 minutes (`sessionTtl`).
- **Reactive, not proactive** — checked on every `_getSession()` call; no background timer. Secret can live past TTL in memory until next call.

### Zeroization
- **None.** `Fr` holds secret; JS has no secure buffer wipe. GC timing unpredictable.

## 5. Transaction pipeline (key facts)

**UI send** → `ExecutionServiceClient.executeTransfer` → SW `ExecutionService.executeTransfer`:
1. `buildTransferOperation` → `SendTransactionOperation`
2. `buildAndEstimateTxRequest`:
   - Dispatches on `feeSettings.paymentMethod.kind` (fj / fjwc / fpc / embedded)
   - `fpc` is **two-pass** (baseline estimate → prepend FPC payload → re-simulate)
   - Calls `buildTxRequest` → contract registration → `account.buildTxExecutionRequest` (NuloAccount adapter wraps upstream `DefaultAccountEntrypoint`; handles payload chunking and init-nullifier deploy path)
   - Random nonce `Fr.random()` — **no per-account mutex**; relies on `TxContext.txNonce` for replay protection
3. `proveTxTask` → offscreen PXE `proveTx` (write lock)
4. `sendTxTask` → `node.sendTx`
5. Persist via `transactionService.addTransaction`; `TaskService` tree reports subtask status

**dApp send** → content script (thin relay using `@aztec/wallet-sdk`) → SW `DappInteractionService.execute` → opens approval window (`chrome.windows.create`) → user approves → `executeOperations` → same pipeline.

**Post-submit tracking** → `TransactionService.runWorker` polls `node.getTxReceipt` every 1s for each pending tx, updates status, emits `onTransactionUpdated`.

## 6. PXE specifics

- Offscreen creation via `ensureOffscreenRunning()` (PING/PONG health check, zombie kill).
- Per-chain PXE map keyed by chainId: `Map<chainId, PXE>`, `Map<chainId, AztecNode>`, dedupe via `chainInitPromises`.
- PXE data dir: `pxe/${profileId}/${chainId}` in IndexedDB.
- **Artifact resolution cascade**: local PXE → known artifacts → public registry (gated by `contractRegistry` config, only 2 chains hardcoded).
- `ReadWriteGuard` — writes serialized, **reads currently don't block during writes** (documented as TODO for phase 2 in `rw-guard.ts:11`). This is a real race window during profile switch/delete.
- PXE sync state is **implicit** — code only logs gaps between `pxe.getSyncedBlockHeader` and `node.getBlockNumber`, no gating.

## 7. Testing surface (actual vs. theoretical)

- **Unit tests:** 9 files, 108 tests passing. Coverage concentrated on wallet services (encryption, task lifecycle, some business logic). UI components — 0. Stores — 0.
- **E2E tests:** 13 files (Puppeteer). 15 failing / 4 skipped reported — startup timeouts on SW readiness. Infrastructure unstable.
- **Type errors:** 145+ pre-existing. Mostly `@aztec/*` SDK type mismatches (Fr ↔ IntentInnerHash, AztecAddress ↔ hex strings, `bigint.toBigInt`), plus some domain errors (Property 'worker' missing).
- **~10 `.js` files** should be `.ts`: `src/utils/core.js` (module-level singletons), some composables, some utils.

### What's un-unit-testable today (codex + my analysis agree)
- **ExecutionService** — 10-deep service imports at module scope, PxeServiceClient instantiation inline, no seams.
- **DappInteractionService** — `chrome.windows.create` embedded in service method.
- **PasskeyService** — same, plus WebAuthn surface not abstracted.
- **TokenBalanceService** — hidden async worker, no way to inject clock.
- **`src/utils/core.js` singletons** — eagerly connect clients at import time; any UI code that imports this cannot be unit-tested without a live SW port.

## 8. Implicit ordering + hidden globals

- **Service startup = `Promise.all`** of `service.init(services)`. No declared ordering. Services defensively `await ensureInitialized()` (30s poll) on every public method (`background/service.ts:124`, `offscreen/service.ts:122`).
- **`src/utils/core.js`** creates `managers.profile` + `managers.contact` at module eval. Connects ports eagerly. Any test that imports a consumer must stub `chrome.runtime`.
- **`src/wallet/index.ts`** is a God-constructor: every service imported and wired in one function, concrete types known everywhere.
- **Event bus is ephemeral** — no replay, no snapshot-with-subscribe handshake. Popup reconnect after SW restart loses emitted events; consumers must resync via ad hoc `get*()` methods.

## 9. Risk register (consolidated, ranked)

### Security / correctness
- **`session.passhash` in `chrome.storage.session`** — bearer credential during active session; anyone who reads session storage can decrypt secret. Requires deliberate product decision.
- **ReadWriteGuard reads don't drain** — profile switch/delete can race in-flight PXE reads.
- **Plaintext metadata at rest** — contacts, dApp sessions, tx history, token list — mismatches "privacy-first" branding.
- **No zeroization** of decrypted secret / passhash buffers.
- **Reactive session TTL** — secret stays resident past TTL until next call.
- **RP ID + KDF labels + AccountType enum value = immutable crypto boundaries.** Any refactor must preserve them. No rotation mechanism.

### Operational
- **Pending dApp approvals + passkey prompts are in-memory only** — dropped on SW restart.
- **No hard timeout on worker RPC** — wedged background call stays pending until port drops.
- **PXE sync state is implicit** — no "safe to prove" gating.

### Structural
- **ExecutionService God class** (2000+ LOC, 10 deps).
- **Startup order implicit** (`Promise.all` + defensive polling).
- **Wire format contract implicit** (Zod rehydration ad hoc).
- **Content script bridge partly opaque** (lives in `@aztec/wallet-sdk` dependency).

### Minor / process
- **`SimpleStorage`, per-collection versioning API, setup app, commented install handler** — dead surfaces.
- **`[theme=light]` broken** (pre-existing).
- **`host_permissions: ["https://nulo.sh/"]`** — used only for passkey RP ID resolution; otherwise vestigial.

## 10. Additional findings from codex 06-07 (dApp bridge)

### Transaction pipeline subtleties
- **`buildAndEstimateTxRequest` mutates `op.actions`** via `unshift()` for `fjwc` + `fpc` payment methods. Popup estimator clones `op.actions` first (`execution/service.ts:373`) to compensate. Side effect is hidden; future callers will be surprised.
- **Popup optimistic placeholder** reconciled by heuristic matching on account/contract/destination (`app.store.ts:133`) — fragile.
- **`send.vue` navigates away after fixed 700ms** even though proving continues — UI workflow isn't a durable primitive.
- **Public authwit actions mutate AuthRegistryService** as a side-effect during `buildTxRequest` (line 1972). Implicit cross-service coupling.

### dApp bridge specifics
- **No injected in-page provider in `src/`.** All page-side logic lives in `@aztec/wallet-sdk` (discovery, ECDH, MessagePort). Local code is a relay + session/capability layer.
- **Two-layer permission model**: `DappSession` existence (connect) + `capability grants` (separate approval). Non-trivial product/security surface.
- **`WalletSdkDispatcher`** enforces capability-to-method mapping (`capability-map.ts:17`) + scope enforcement (`scope-enforcement.ts:223`).
- **⚠️ `createAuthWit` scope enforcement is incomplete** — `scope-enforcement.ts:202` TODO: call-target scope not validated when intent contains a call. **Near-term security fix.**
- **Monkey-patch on wallet-sdk's private decrypt queue** (`background.ts:164-182`) to serialize session messages. Brittle against dep upgrades.
- **Duplicated CAIP resolution** — in both `dispatcher.ts:732` and `execute/index.vue:135`. Should be a single view-model prepared by worker.
- **"First authorized account" silent policy** — account-scoped methods default to `session.accounts[0]`. Multi-account sessions need explicit binding.
- **Pending dApp interactions are in-memory only** — SW restart ⇒ popup comes back with unknown `requestId` ⇒ silent failure path.
- **Chain ID encoding quirk**: `chainId ^ version` used internally — non-obvious.
