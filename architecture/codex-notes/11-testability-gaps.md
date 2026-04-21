# 11 Testability Gaps

## Scope

This note distinguishes:

- areas that are already reasonably unit-testable
- areas that currently resist testing because seams are missing
- gaps in the E2E harness
- concrete remediation work with risk and size estimates

The goal is not "write more tests". The real problem is that most high-value behavior is trapped inside runtime-heavy orchestration code.

## What is already testable

The repo does have a usable testing base:

- unit Vitest config in [`packages/extension/vitest.config.ts:4`](../../packages/extension/vitest.config.ts#L4) through [`vitest.config.ts:15`](../../packages/extension/vitest.config.ts#L15)
- E2E Vitest configs in [`packages/extension/vitest.e2e.config.ts:4`](../../packages/extension/vitest.e2e.config.ts#L4) through [`vitest.e2e.all.config.ts:17`](../../packages/extension/vitest.e2e.all.config.ts#L17)
- a small Chrome runtime mock in [`packages/extension/tests/vitest.setup.ts:75`](../../packages/extension/tests/vitest.setup.ts#L75) through [`vitest.setup.ts:100`](../../packages/extension/tests/vitest.setup.ts#L100)

The testable parts today are mostly pure or near-pure leaf units:

- scope enforcement in [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts)
- task tree logic in [`packages/extension/src/wallet/services/task/service.test.ts`](../../packages/extension/src/wallet/services/task/service.test.ts)
- task RPC client wiring in [`packages/extension/src/wallet/services/task/client.test.ts`](../../packages/extension/src/wallet/services/task/client.test.ts)
- encryption key helpers in [`packages/extension/src/wallet/services/profile/encryption/encryption-key.test.ts`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.test.ts)
- fee detection helpers in [`packages/extension/src/wallet/services/execution/utils/fee-detection.test.ts`](../../packages/extension/src/wallet/services/execution/utils/fee-detection.test.ts)
- mnemonic, logger store, and RW guard utilities in the corresponding `*.test.ts` files

This is the right pattern: tests are easiest where code is deterministic, dependency-light, and not coupled to a live extension runtime.

## Coverage shape today

A rough codebase-level read:

- `325` source `ts/js/vue` files under `packages/extension/src`
- `20` background/offscreen `service.ts` files under `src/wallet/services`
- only `9` colocated `*.test.ts` files under `src`

The missing coverage is not random. It clusters around the most important orchestrators:

- [`packages/extension/src/wallet/services/execution/service.ts`](../../packages/extension/src/wallet/services/execution/service.ts) at `2365` lines
- [`packages/extension/src/wallet/services/profile/service.ts`](../../packages/extension/src/wallet/services/profile/service.ts) at `763` lines
- [`packages/extension/src/wallet/services/pxe/service.ts`](../../packages/extension/src/wallet/services/pxe/service.ts) at `494` lines
- [`packages/extension/src/wallet/services/token-balance/service.ts`](../../packages/extension/src/wallet/services/token-balance/service.ts) at `449` lines
- [`packages/extension/src/wallet/services/dapp-interaction/service.ts`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts) at `435` lines
- [`packages/extension/src/wallet/services/network/service.ts`](../../packages/extension/src/wallet/services/network/service.ts) at `342` lines

That is the architectural signal: small helpers are testable, runtime orchestration is not.

## Main gaps

## 1. Worker bootstrap has module-load side effects

The service worker boots itself at module evaluation time:

- runtime setup in [`packages/extension/src/wallet/index.ts:34`](../../packages/extension/src/wallet/index.ts#L34) through [`wallet/index.ts:62`](../../packages/extension/src/wallet/index.ts#L62)
- service graph construction in [`wallet/index.ts:74`](../../packages/extension/src/wallet/index.ts#L74) through [`wallet/index.ts:104`](../../packages/extension/src/wallet/index.ts#L104)
- infinite heartbeat loop in [`wallet/index.ts:106`](../../packages/extension/src/wallet/index.ts#L106) through [`wallet/index.ts:115`](../../packages/extension/src/wallet/index.ts#L115)
- immediate startup in [`wallet/index.ts:117`](../../packages/extension/src/wallet/index.ts#L117) through [`wallet/index.ts:126`](../../packages/extension/src/wallet/index.ts#L126)

Why this blocks tests:

- importing the worker entrypoint has side effects
- the service graph is created with concrete classes only
- there is no composition root that tests can call with fake services
- the heartbeat loop is not controllable

This is architectural debt, not TypeScript debt.

Remediation:

- extract a pure `createWalletRuntime(deps)` composition function
- move `runHeartbeat()` behind a started/stopped runtime handle
- keep `src/wallet/index.ts` as a thin shell that calls the composition root

Estimate:

- risk: medium
- size: 2-4 days

## 2. Core services construct concrete dependencies instead of receiving ports

Example: [`ExecutionService`](../../packages/extension/src/wallet/services/execution/service.ts) wires itself to many concrete services in `init()`:

- [`packages/extension/src/wallet/services/execution/service.ts:177`](../../packages/extension/src/wallet/services/execution/service.ts#L177) through [`execution/service.ts:188`](../../packages/extension/src/wallet/services/execution/service.ts#L188)

It also creates its own offscreen client:

- [`execution/service.ts:158`](../../packages/extension/src/wallet/services/execution/service.ts#L158)
- [`execution/service.ts:178`](../../packages/extension/src/wallet/services/execution/service.ts#L178)

Example: [`DappInteractionService`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts) depends on five concrete services and directly opens popup windows:

- dependency wiring in [`dapp-interaction/service.ts:53`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L53) through [`dapp-interaction/service.ts:59`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L59)
- popup creation in [`dapp-interaction/service.ts:173`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L173) through [`dapp-interaction/service.ts:193`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L193)

Example: [`NetworkService`](../../packages/extension/src/wallet/services/network/service.ts) directly creates Aztec node clients:

- default node creation in [`network/service.ts:86`](../../packages/extension/src/wallet/services/network/service.ts#L86) through [`network/service.ts:89`](../../packages/extension/src/wallet/services/network/service.ts#L89)
- lazy node creation in [`network/service.ts:232`](../../packages/extension/src/wallet/services/network/service.ts#L232) through [`network/service.ts:247`](../../packages/extension/src/wallet/services/network/service.ts#L247)

Why this blocks tests:

- services cannot be instantiated with fakes for node, PXE, storage, clock, RNG, popup opening, or RPC transport
- test setup must re-create too much of the extension runtime
- service APIs are coupled to implementation classes, not domain interfaces

This is architectural debt.

Remediation:

- define explicit ports: `PxePort`, `NodeFactory`, `Clock`, `Random`, `WindowOpener`, `ProfileRepository`, `SessionRepository`
- pass them in constructors or typed factory functions
- reserve `ServiceCollection` for wiring, not service-owned object creation

Estimate:

- risk: high
- size: 2-3 weeks for first wave across `ExecutionService`, `ProfileService`, `NetworkService`, `DappInteractionService`

## 3. Popup state depends on module-global singletons

`utils/core.js` creates live clients at import time:

- [`packages/extension/src/utils/core.js:14`](../../packages/extension/src/utils/core.js#L14) through [`utils/core.js:27`](../../packages/extension/src/utils/core.js#L27)

It also exports mutable singleton slots:

- [`utils/core.js:22`](../../packages/extension/src/utils/core.js#L22) through [`utils/core.js:27`](../../packages/extension/src/utils/core.js#L27)
- transaction re-init in [`utils/core.js:53`](../../packages/extension/src/utils/core.js#L53) through [`utils/core.js:59`](../../packages/extension/src/utils/core.js#L59)

`App.vue` then builds app bootstrap on top of those globals:

- imports in [`packages/extension/src/popup/app.vue:7`](../../packages/extension/src/popup/app.vue#L7)
- network/account/session bootstrap in [`popup/app.vue:75`](../../packages/extension/src/popup/app.vue#L75) through [`popup/app.vue:225`](../../packages/extension/src/popup/app.vue#L225)

Why this blocks tests:

- importing a component can connect to background services
- Pinia stores are not the only state source; tests must also control `managers`
- route tests need a live background-messaging mock, not just component props/store state

This is architectural debt.

Remediation:

- replace `utils/core.js` with an explicit UI runtime plugin provided at app mount
- expose service clients through Vue injection or a Pinia-accessible service registry
- make `App.vue` delegate bootstrap to composables with injectable dependencies

Estimate:

- risk: medium
- size: 4-6 days

## 4. Chrome APIs are called inline across UI and services

The codebase has widespread direct `chrome.*` usage across services, composables, popup windows, and storage wrappers. A few representative spots:

- storage reads in [`packages/extension/src/stores/app.store.ts:61`](../../packages/extension/src/stores/app.store.ts#L61) through [`app.store.ts:91`](../../packages/extension/src/stores/app.store.ts#L91)
- side panel behavior in [`packages/extension/src/popup/app.vue:59`](../../packages/extension/src/popup/app.vue#L59) through [`popup/app.vue:63`](../../packages/extension/src/popup/app.vue#L63)
- popup window lifecycle in [`dapp-interaction/service.ts:173`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L173) through [`dapp-interaction/service.ts:193`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L193)
- passkey window creation in [`packages/extension/src/wallet/services/passkey/service.ts:59`](../../packages/extension/src/wallet/services/passkey/service.ts#L59) through [`passkey/service.ts:84`](../../packages/extension/src/wallet/services/passkey/service.ts#L84)

The test harness only mocks a narrow slice of runtime APIs:

- [`packages/extension/tests/vitest.setup.ts:75`](../../packages/extension/tests/vitest.setup.ts#L75) through [`vitest.setup.ts:100`](../../packages/extension/tests/vitest.setup.ts#L100)

It does not provide realistic behavior for:

- `chrome.storage.local/session`
- `chrome.windows`
- `chrome.tabs`
- `chrome.action`
- `chrome.sidePanel`
- `chrome.offscreen`
- permission APIs

Why this blocks tests:

- each new test must hand-roll more browser mocking
- behavior tests can silently become transport-mock tests
- offscreen and popup lifecycle logic is effectively untestable in unit scope

This is mostly architectural debt. Some of the missing mocks are just test infrastructure debt.

Remediation:

- introduce a narrow `BrowserApi` adapter package with typed sub-ports
- keep one production implementation backed by `chrome`
- keep one memory/fake implementation for unit and integration tests
- move the current Vitest helpers under that abstraction instead of mocking globals ad hoc

Estimate:

- risk: medium
- size: 3-5 days

## 5. Offscreen PXE access is tightly coupled to runtime messaging

`PxeServiceClient` forces every call through offscreen lifecycle management:

- [`packages/extension/src/wallet/services/pxe/client.ts:44`](../../packages/extension/src/wallet/services/pxe/client.ts#L44) through [`pxe/client.ts:153`](../../packages/extension/src/wallet/services/pxe/client.ts#L153)

Every public method does:

- `await ensureOffscreenRunning()`
- offscreen RPC request
- schema rehydration

Why this blocks tests:

- unit tests for execution logic must either mock the whole offscreen transport or instantiate a real offscreen-compatible environment
- PXE serialization concerns are mixed into domain workflows
- the only stable seam today is "mock the whole client object"

This is architectural debt.

Remediation:

- separate three concerns:
  - `PxePort` domain interface used by execution/token/note services
  - `OffscreenPxeTransport` that owns extension messaging and offscreen lifecycle
  - schema codecs at the edge
- write contract tests for transport, and pure unit tests for services against a fake `PxePort`

Estimate:

- risk: high
- size: 1-2 weeks

## 6. Storage and session behavior are hard to drive deterministically

`ProfileService` owns storage, crypto, passkey flow, TTL, and in-memory active session state:

- construction in [`packages/extension/src/wallet/services/profile/service.ts:42`](../../packages/extension/src/wallet/services/profile/service.ts#L42) through [`profile/service.ts:48`](../../packages/extension/src/wallet/services/profile/service.ts#L48)
- startup restore in [`profile/service.ts:50`](../../packages/extension/src/wallet/services/profile/service.ts#L50) through [`profile/service.ts:71`](../../packages/extension/src/wallet/services/profile/service.ts#L71)
- password creation in [`profile/service.ts:90`](../../packages/extension/src/wallet/services/profile/service.ts#L90) through [`profile/service.ts:121`](../../packages/extension/src/wallet/services/profile/service.ts#L121)
- passkey creation in [`profile/service.ts:156`](../../packages/extension/src/wallet/services/profile/service.ts#L156) through [`profile/service.ts:189`](../../packages/extension/src/wallet/services/profile/service.ts#L189)

Why this blocks tests:

- no injectable clock for TTL
- no injectable entropy/random ID source
- no repository abstraction around storage
- passkey flows require live popup orchestration or large mocks

This is architectural debt.

Remediation:

- split `ProfileService` into:
  - `ProfileRepository`
  - `SessionManager`
  - `PasswordProfileCrypto`
  - `PasskeyProfileCoordinator`
- inject `Clock` and `Random`
- keep one thin background facade service over those modules

Estimate:

- risk: high
- size: 1-2 weeks

## 7. E2E coverage is real but expensive and brittle

The E2E harness is better than nothing, but it is very heavy:

- requires a built extension in [`packages/extension/tests/e2e/global-setup-smoke.ts:24`](../../packages/extension/tests/e2e/global-setup-smoke.ts#L24) through [`global-setup-smoke.ts:29`](../../packages/extension/tests/e2e/global-setup-smoke.ts#L29)
- launches a full browser with the extension in [`packages/extension/tests/e2e/fixtures/extension.ts:13`](../../packages/extension/tests/e2e/fixtures/extension.ts#L13) through [`extension.ts:55`](../../packages/extension/tests/e2e/fixtures/extension.ts#L55)
- waits for worker liveness via `chrome.storage.session` in [`extension.ts:36`](../../packages/extension/tests/e2e/fixtures/extension.ts#L36) through [`extension.ts:52`](../../packages/extension/tests/e2e/fixtures/extension.ts#L52)
- can auto-start a real local Aztec node and deploy contracts in [`packages/extension/tests/e2e/global-setup.ts:38`](../../packages/extension/tests/e2e/global-setup.ts#L38) through [`global-setup.ts:112`](../../packages/extension/tests/e2e/global-setup.ts#L112)

The dApp connection test is explicitly skipped because it depends on an external site:

- [`packages/extension/tests/e2e/connect-dapp.test.ts:4`](../../packages/extension/tests/e2e/connect-dapp.test.ts#L4) through [`connect-dapp.test.ts:13`](../../packages/extension/tests/e2e/connect-dapp.test.ts#L13)

The helpers are also UI-copy-sensitive:

- text selectors and DOM scripting throughout [`packages/extension/tests/e2e/fixtures/helpers.ts`](../../packages/extension/tests/e2e/fixtures/helpers.ts)
- text-driven registration flow in [`packages/extension/tests/e2e/registration.test.ts:13`](../../packages/extension/tests/e2e/registration.test.ts#L13) through [`registration.test.ts:76`](../../packages/extension/tests/e2e/registration.test.ts#L76)

Why this blocks tests:

- running E2E routinely is slow and infra-dependent
- approval-window and worker/offscreen flows are covered only through the heaviest possible path
- small copy changes can break selectors
- there is no middle layer of worker+offscreen integration tests without Chromium

This is mostly test infrastructure debt, but some brittleness comes from UI architecture and missing test IDs.

Remediation:

- create a middle tier of "runtime integration" tests that start services with fake browser ports and fake PXE/node adapters
- move dApp E2E to a local deterministic fixture page bundled in the repo
- standardize durable `data-testid` selectors for all critical flows
- keep full Chromium+Aztec tests for a narrow smoke set only

Estimate:

- risk: medium
- size: 1-2 weeks

## 8. There is no contract-test layer for service messaging

The background RPC pattern is structurally testable, but today only `TaskServiceClient` is really exercising it:

- see [`packages/extension/src/wallet/services/task/client.test.ts:30`](../../packages/extension/src/wallet/services/task/client.test.ts#L30) through [`task/client.test.ts:99`](../../packages/extension/src/wallet/services/task/client.test.ts#L99)

Why this matters:

- request/response/event wiring is a major platform seam
- each service client currently relies on inheritance and naming conventions
- regressions in serialization, reconnection, or event delivery can escape until E2E

This is test infrastructure debt more than architectural debt.

Remediation:

- add reusable contract-test suites for any `ServiceClient`/`Service` pair
- assert request method names, event fan-out, timeout behavior, disconnection handling, and JSON-safe payload shape
- use the same suite for background and offscreen RPC transports

Estimate:

- risk: low
- size: 2-3 days

## What is pre-existing TS debt vs architectural debt

## Mostly TypeScript or local code-quality debt

- some `null!` dependency fields
- some `any` in mocks and event plumbing
- long files and weak type locality

These matter, but they are not the main reason testing is hard.

## Mostly architectural debt

- module-load boot side effects
- concrete dependency construction inside services
- UI singletons outside Vue/Pinia injection
- direct `chrome.*` calls throughout business logic
- offscreen transport mixed with PXE domain logic
- no layered test pyramid between unit and full-browser E2E

That is the actual blocker.

## Recommended target test pyramid

The codebase needs three deliberate layers:

1. Pure unit tests.
For fee logic, auth scope, operation planning, storage codecs, session state machines, and transaction classification.

2. Runtime integration tests.
Start the service graph in-process with fake browser APIs, fake node/PXE ports, and deterministic storage. This should cover register, unlock, send, and dApp approval flows without Chromium.

3. Narrow end-to-end browser tests.
Keep a small smoke pack for popup rendering, approval windows, content-script bridge wiring, and one real local-network transaction path.

Right now the repo jumps from layer 1 to layer 3, leaving the most valuable orchestration logic poorly defended.

## Immediate wins

If the team wants the fastest return, the first changes should be:

1. Extract a `BrowserApi` adapter and stop calling `chrome.*` directly from domain logic.
Risk: medium.
Size: 3-5 days.

2. Replace `utils/core.js` singletons with injected UI services.
Risk: medium.
Size: 4-6 days.

3. Split worker bootstrap into a composition root plus thin entrypoint.
Risk: medium.
Size: 2-4 days.

4. Introduce fakeable `PxePort` and `NodeFactory` interfaces.
Risk: high.
Size: 1-2 weeks.

5. Add repo-local dApp fixtures and stable `data-testid` coverage for critical UX.
Risk: low.
Size: 2-4 days.

## Bottom line

The extension is not "untestable". It is selectively testable:

- pure helpers and small services test well
- runtime orchestration does not

The missing piece is not more Vitest syntax. It is dependency boundaries. Until those exist, most important wallet behavior will remain either untested or only testable through slow, brittle, full-browser scenarios.
