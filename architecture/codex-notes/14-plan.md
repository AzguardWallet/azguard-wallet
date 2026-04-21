# 14 Plan

## Goal

Evolve the extension from a working MV3 wallet into a codebase that is:

- modular enough to change without fear
- unit-testable below the browser runtime
- deterministic in end-to-end tests
- resilient to MV3 worker restarts
- ready for production hardening without a rewrite

This plan is intentionally incremental. The code does not need a big-bang rewrite. It needs sharper boundaries, durable state around long-lived flows, and smaller runtime shells.

## What this plan is optimizing for

The plan is driven by the highest-value architectural problems in the current code:

- worker bootstrap is side-effectful and constructs the whole system in one place in [`packages/extension/src/wallet/index.ts:34`](../../packages/extension/src/wallet/index.ts#L34) through [`wallet/index.ts:126`](../../packages/extension/src/wallet/index.ts#L126)
- popup code depends on long-lived global service clients from [`packages/extension/src/utils/core.js:14`](../../packages/extension/src/utils/core.js#L14) through [`utils/core.js:59`](../../packages/extension/src/utils/core.js#L59)
- approval, passkey, and task state are held in memory in:
  - [`packages/extension/src/wallet/services/dapp-interaction/service.ts:40`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L40) through [`dapp-interaction/service.ts:41`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L41)
  - [`packages/extension/src/wallet/services/passkey/service.ts:13`](../../packages/extension/src/wallet/services/passkey/service.ts#L13)
  - [`packages/extension/src/wallet/services/task/service.ts:31`](../../packages/extension/src/wallet/services/task/service.ts#L31) through [`task/service.ts:32`](../../packages/extension/src/wallet/services/task/service.ts#L32)
- the send flow durably records a transaction only after `sendTx` succeeds in [`packages/extension/src/wallet/services/execution/service.ts:305`](../../packages/extension/src/wallet/services/execution/service.ts#L305) through [`execution/service.ts:343`](../../packages/extension/src/wallet/services/execution/service.ts#L343)
- popup optimism assumes background continuity in [`packages/extension/src/popup/pages/send.vue:257`](../../packages/extension/src/popup/pages/send.vue#L257) through [`send.vue:297`](../../packages/extension/src/popup/pages/send.vue#L297)
- `createAuthWit` scope enforcement is explicitly incomplete in [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts:192`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L192) through [`scope-enforcement.ts:204`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L204)

Those are architectural debt items. They are more important than generic TypeScript cleanup.

## Principles

1. Fix restart-safety before package extraction.
2. Introduce ports before moving code into new workspaces.
3. Keep MV3 shells thin: popup, content script, service worker, and offscreen should mostly translate events and delegate.
4. Do not mix type-churn with boundary work unless the type change is needed to define a seam.
5. Every refactor milestone must improve one of the three critical flows:
   - cold-start register
   - unlock plus send
   - dApp `sendTransaction`

## External calibration

These patterns align with current extension and wallet practice:

- Chrome's offscreen docs position offscreen documents as a narrow runtime edge using `chrome.runtime` messaging, not as a second application host. Source: [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen).
- Rabby's public architecture keeps `background`, `content-script`, injected provider, and UI in separate contexts with narrow responsibilities. Source: [Rabby README](https://github.com/RabbyHub/Rabby).
- MetaMask's current public `core` monorepo shows the value of extracting reusable controllers and services out of the extension shell. Source: [MetaMask/core](https://github.com/MetaMask/core).
- Wagmi continues to push the same model from another angle: framework-agnostic core plus adapter layers. Source: [wagmi home](https://wagmi.sh/), [Why Wagmi Core](https://wagmi.sh/core/why), [Core getting started](https://wagmi.sh/core/getting-started).
- EIP-6963 formalizes thin discovery and multi-wallet coexistence for injected providers. Nulo's Aztec wallet bridge is different, but the same design lesson applies: keep page-facing glue minimal and protocol-driven. Source: [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963).

## Non-goals

- no Vue rewrite
- no Pinia rewrite
- no immediate workspace explosion
- no Aztec runtime rewrite before tests exist
- no broad "fix all `any`" pass

## Milestone 1: Stabilize the current architecture

Target: 7 mergeable PRs, roughly 1 per day.

Goal:

- make the critical flows restart-safe enough to debug
- close the most obvious security and reliability gaps
- add the first deterministic test seams

### PR 1. Approval and passkey flows fail fast

Change:

- reject approval promises when `chrome.windows.create` fails or returns no window id
- add explicit timeout handling for popup-backed approvals
- surface terminal failures to the popup UI instead of leaving requests pending forever

Files:

- [`packages/extension/src/wallet/services/dapp-interaction/service.ts:173`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L173) through [`dapp-interaction/service.ts:195`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L195)
- [`packages/extension/src/wallet/services/passkey/service.ts:59`](../../packages/extension/src/wallet/services/passkey/service.ts#L59) through [`passkey/service.ts:89`](../../packages/extension/src/wallet/services/passkey/service.ts#L89)

Tests:

- unit tests for failure and timeout branches
- one integration test that closes the popup before approval completion

Risk and size:

- delivery risk: low
- size: less than 1 day

### PR 2. Persist pending approval, passkey, and task envelopes

Change:

- move request envelopes out of process memory into session storage with TTL
- keep only active resolver handles in memory
- let popup windows rehydrate by `requestId` after worker restart

Files:

- [`packages/extension/src/wallet/services/dapp-interaction/service.ts:40`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L40) through [`dapp-interaction/service.ts:41`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L41)
- [`packages/extension/src/wallet/services/passkey/service.ts:13`](../../packages/extension/src/wallet/services/passkey/service.ts#L13)
- [`packages/extension/src/wallet/services/task/service.ts:31`](../../packages/extension/src/wallet/services/task/service.ts#L31) through [`task/service.ts:32`](../../packages/extension/src/wallet/services/task/service.ts#L32)

Tests:

- service-level tests for persistence and TTL expiry
- worker-restart integration test for an open approval request

Risk and size:

- delivery risk: medium
- size: 1-2 days

### PR 3. Add a durable pending-operation journal before proof generation

Change:

- create a durable operation record before proving starts
- drive it through `planned`, `proving`, `submitting`, `submitted`, `failed`
- make the popup render from that record instead of assuming the worker will stay alive

Files:

- [`packages/extension/src/wallet/services/execution/service.ts:305`](../../packages/extension/src/wallet/services/execution/service.ts#L305) through [`execution/service.ts:343`](../../packages/extension/src/wallet/services/execution/service.ts#L343)
- [`packages/extension/src/popup/pages/send.vue:257`](../../packages/extension/src/popup/pages/send.vue#L257) through [`send.vue:297`](../../packages/extension/src/popup/pages/send.vue#L297)

Tests:

- unit tests for state transitions
- integration test simulating worker restart after proving begins

Risk and size:

- delivery risk: medium
- size: 2-3 days

### PR 4. Finish `createAuthWit` scope enforcement

Change:

- validate `CallIntent.call.to` and `call.name` against the same scope model used for transaction execution
- deny authwits that exceed granted call scope

Files:

- [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts:192`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L192) through [`scope-enforcement.ts:204`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L204)

Tests:

- extend [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts)
- include both allowed and denied contract-call cases

Risk and size:

- delivery risk: medium
- size: 1-2 days

### PR 5. Add a deterministic local e2e harness for the three critical flows

Change:

- add a local dApp fixture and stop depending on a skipped external dApp test as the main bridge signal
- make the three critical flows first-class smoke scenarios:
  - register
  - unlock plus send
  - dApp `sendTransaction`
- stabilize selectors and fixture bootstrapping

Files:

- [`packages/extension/tests/e2e/connect-dapp.test.ts:4`](../../packages/extension/tests/e2e/connect-dapp.test.ts#L4) through [`connect-dapp.test.ts:13`](../../packages/extension/tests/e2e/connect-dapp.test.ts#L13)
- [`packages/extension/tests/e2e/global-setup.ts:38`](../../packages/extension/tests/e2e/global-setup.ts#L38) through [`global-setup.ts:112`](../../packages/extension/tests/e2e/global-setup.ts#L112)
- [`packages/extension/tests/e2e/fixtures/extension.ts:13`](../../packages/extension/tests/e2e/fixtures/extension.ts#L13) through [`fixtures/extension.ts:55`](../../packages/extension/tests/e2e/fixtures/extension.ts#L55)

Tests:

- the PR is the tests

Risk and size:

- delivery risk: medium
- size: 2-4 days

### PR 6. Introduce a worker composition root and `BrowserApi` facade

Change:

- move service construction out of `wallet/index.ts` into a pure factory
- define a single adapter surface for `chrome.*` usage
- keep runtime wiring in the shell and make services consume ports

Files:

- [`packages/extension/src/wallet/index.ts:34`](../../packages/extension/src/wallet/index.ts#L34) through [`wallet/index.ts:126`](../../packages/extension/src/wallet/index.ts#L126)
- [`packages/extension/src/wallet/base/index.ts:25`](../../packages/extension/src/wallet/base/index.ts#L25) through [`wallet/base/index.ts:45`](../../packages/extension/src/wallet/base/index.ts#L45)

Tests:

- unit tests for service composition with fake browser adapters
- startup test asserting deterministic registration order

Risk and size:

- delivery risk: medium
- size: 2-3 days

### PR 7. Remove popup-global service singletons

Change:

- replace `utils/core.js` singleton clients with an explicit app service context
- make stores and composables consume injected clients rather than module globals

Files:

- [`packages/extension/src/utils/core.js:14`](../../packages/extension/src/utils/core.js#L14) through [`utils/core.js:59`](../../packages/extension/src/utils/core.js#L59)
- [`packages/extension/src/popup/app.vue:42`](../../packages/extension/src/popup/app.vue#L42) through [`app.vue:260`](../../packages/extension/src/popup/app.vue#L260)

Tests:

- component tests with injected fake clients
- route bootstrap test for popup and sidepanel entry

Risk and size:

- delivery risk: medium
- size: 2-3 days

### Milestone 1 exit criteria

- an approval window, passkey window, or send flow can survive a worker restart without becoming unrecoverable
- the three critical flows run in deterministic e2e against local fixtures
- new tests no longer need to mock the entire `chrome` runtime globally just to exercise core logic
- the security gap around `createAuthWit` scope is closed

## Milestone 2: Split orchestration from domain logic

Target: 2-3 weeks.

Goal:

- break the two God services into smaller collaborators
- make policy logic unit-testable without browser or Aztec runtime dependencies

### 2.1 Split `ProfileService`

Current problem:

- one service owns session restore, password secret decryption, passkey flows, storage, and profile lifecycle
- evidence includes password-session restore in [`packages/extension/src/wallet/services/profile/service.ts:531`](../../packages/extension/src/wallet/services/profile/service.ts#L531) through [`profile/service.ts:570`](../../packages/extension/src/wallet/services/profile/service.ts#L570)

Target split:

- `ProfileRepository`
- `SessionManager`
- `PasswordSecretBox`
- `PasskeyRecoveryCoordinator`

Risk and size:

- delivery risk: medium
- size: 1 week

### 2.2 Split `ExecutionService`

Current problem:

- planning, fee logic, artifact registration, PXE interaction, proving, sending, and tx persistence are all mixed in one service

Target split:

- `OperationPlanner`
- `ExecutionCoordinator`
- `FeePolicy`
- `TransactionJournal`
- `ExecutionFacade` for background RPC

Risk and size:

- delivery risk: high
- size: 1-2 weeks

### 2.3 Introduce first-class ports

Introduce interfaces in `src/core/` first:

- `Clock`
- `SessionStore`
- `ProfileStore`
- `ApprovalPort`
- `PxePort`
- `NodePort`
- `BrowserApi`

This is the prerequisite for real unit tests. Do this before workspace extraction.

Risk and size:

- delivery risk: low
- size: 2-4 days

### 2.4 Add contract tests for the runtime edges

Add focused tests for:

- popup-to-worker RPC
- worker-to-offscreen RPC
- content-script bridge envelope parsing

The point is not to test Chrome. The point is to lock down Nulo's wire contracts.

Risk and size:

- delivery risk: medium
- size: 3-5 days

### Milestone 2 exit criteria

- the highest-value policy logic runs in pure unit tests
- `ProfileService` and `ExecutionService` become façades over smaller modules
- runtime edges have explicit contracts and focused tests

## Milestone 3: Promote stable internal seams into packages

Target: 2-4 weeks.

Goal:

- preserve the new boundaries by enforcing them at the package level

Recommended extraction order:

1. `@nulo/wallet-core`
2. `@nulo/wallet-crypto`
3. `@nulo/extension-messaging`
4. `@nulo/aztec-runtime`
5. `@nulo/wallet-bridge`
6. optional `@nulo/extension-ui` only after the internal UI service context settles

Why this order:

- `wallet-core` and `wallet-crypto` already have the clearest pure seams
- `extension-messaging` becomes stable once the worker composition root and RPC contract tests exist
- `aztec-runtime` should move only after `ExecutionService` is split, otherwise the God class just changes package

Work:

- start by moving code into `packages/extension/src/core/`
- convert imports
- only then promote stable modules into Bun workspaces

Risk and size:

- delivery risk: medium
- size: 2-4 weeks

### Milestone 3 exit criteria

- browser runtime code no longer imports deep domain modules directly
- pure modules are consumable in unit tests without loading MV3 or Vue code
- package boundaries prevent regression into cross-layer imports

## Milestone 4: Production hardening

Target: 2-3 weeks.

Goal:

- reduce attack surface
- harden trust boundaries
- make CI reliable enough for release gating

### 4.1 Review content-script scope

Current evidence:

- content script is registered for `*://*/*`, all frames, `document_start` in [`packages/extension/manifest/manifest.config.ts:25`](../../packages/extension/manifest/manifest.config.ts#L25) through [`manifest.config.ts:31`](../../packages/extension/manifest/manifest.config.ts#L31)

Work:

- keep broad injection only if product requirement is explicit
- otherwise move toward dynamic registration for active dApp sessions
- regardless, minimize static content-script code and add hostile-frame tests

Risk and size:

- delivery risk: medium
- size: 3-7 days

### 4.2 Harden session and secret handling

Current evidence:

- password session restore persists a password-equivalent secret in [`packages/extension/src/wallet/services/profile/service.ts:531`](../../packages/extension/src/wallet/services/profile/service.ts#L531) through [`profile/service.ts:570`](../../packages/extension/src/wallet/services/profile/service.ts#L570)

Work:

- stop persisting raw `passhash` as a reusable bearer credential
- replace it with a dedicated session secret or a wrapped session token
- define rotation and revocation rules

Risk and size:

- delivery risk: high
- size: 4-7 days

### 4.3 Harden remote registry trust and network defaults

Current evidence:

- remote artifact registry fetch in [`packages/extension/src/wallet/services/pxe/service.ts:426`](../../packages/extension/src/wallet/services/pxe/service.ts#L426) through [`pxe/service.ts:460`](../../packages/extension/src/wallet/services/pxe/service.ts#L460)
- hardcoded default networks in [`packages/extension/src/wallet/services/network/service.ts:53`](../../packages/extension/src/wallet/services/network/service.ts#L53) through [`network/service.ts:85`](../../packages/extension/src/wallet/services/network/service.ts#L85)

Work:

- validate fetched artifacts against expected class ids
- pin production registries and make environments explicit
- audit default network trust assumptions

Risk and size:

- delivery risk: medium
- size: 2-4 days

### 4.4 Make offscreen lifecycle observable and recoverable

Current evidence:

- offscreen responses can be dropped if the worker dies after the offscreen reply is emitted in [`packages/extension/src/wallet/base/offscreen/service.ts:97`](../../packages/extension/src/wallet/base/offscreen/service.ts#L97) through [`offscreen/service.ts:103`](../../packages/extension/src/wallet/base/offscreen/service.ts#L103)

Work:

- add request ids, terminal status telemetry, and retry-safe operations where possible
- define which PXE actions are idempotent and which require compensation
- expose health signals for worker and offscreen restarts

Risk and size:

- delivery risk: medium
- size: 3-5 days

### Milestone 4 exit criteria

- release CI runs unit, integration, and local e2e gates reliably
- the extension can explain or recover from worker/offscreen restarts
- trust boundaries around secrets, registry data, and page injection are explicit

## TypeScript debt vs architectural debt

Architectural debt to prioritize first:

- hidden globals
- runtime-coupled services
- in-memory-only long-lived state
- implicit ordering dependencies
- browser and Aztec side effects mixed with policy logic

TypeScript debt to treat as opportunistic:

- broad `any` usage
- DTO duplication
- missing discriminated unions
- inconsistent naming and file shape

The rule should be simple: only pay TS debt when it helps define or protect a boundary. Do not start with cosmetic type cleanup.

## What I would measure

- time to run the three critical e2e flows locally
- number of pure unit tests that do not require `chrome` mocks
- number of flows that survive service-worker restart
- ratio of popup/store modules that still import singleton clients
- number of services that can be constructed with fake ports in isolation

## Recommended execution order

If I were staffing this tomorrow, I would do it in this order:

1. Merge the Milestone 1 reliability and testability PRs.
2. Split `ProfileService` and `ExecutionService` behind internal ports.
3. Add runtime contract tests around popup, worker, offscreen, and bridge messaging.
4. Promote stable seams into workspace packages.
5. Finish production hardening last, once the code is easy to reason about.

That order avoids the most common failure mode in wallet refactors: package churn first, runtime correctness later.
