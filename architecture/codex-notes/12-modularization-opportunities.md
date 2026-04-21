# 12 Modularization Opportunities

## Scope

This note proposes a modularization strategy for turning the extension into a production-quality codebase with:

- explicit runtime boundaries
- unit-testable core logic
- replaceable browser and Aztec adapters
- a thinner popup/content-script/offscreen shell

The recommendation is incremental. Do not start by splitting every file into a new workspace package. First establish clean internal module boundaries, then promote the stable ones into Bun workspace packages.

## Current mixing problem

Today `packages/extension/src/wallet/services` mixes four different concerns in the same layer:

1. domain logic
2. application orchestration
3. browser-extension transport/runtime code
4. Aztec SDK and PXE integration

Representative examples:

- `ExecutionService` mixes operation planning, fee policy, contract registration, PXE access, and transaction persistence in one `2365` line service in [`packages/extension/src/wallet/services/execution/service.ts`](../../packages/extension/src/wallet/services/execution/service.ts)
- `ProfileService` mixes storage, crypto, session TTL, and passkey orchestration in [`packages/extension/src/wallet/services/profile/service.ts`](../../packages/extension/src/wallet/services/profile/service.ts)
- `PxeServiceClient` mixes domain API with offscreen lifecycle and extension messaging in [`packages/extension/src/wallet/services/pxe/client.ts:30`](../../packages/extension/src/wallet/services/pxe/client.ts#L30) through [`pxe/client.ts:155`](../../packages/extension/src/wallet/services/pxe/client.ts#L155)
- popup bootstrap depends on global clients in [`packages/extension/src/utils/core.js:14`](../../packages/extension/src/utils/core.js#L14) through [`utils/core.js:59`](../../packages/extension/src/utils/core.js#L59)

That structure is why the code is hard to test and hard to reason about. The boundary problem comes first; package extraction comes second.

## External patterns worth copying

Current wallet/extension patterns point in the same direction:

- Chrome's offscreen API documentation says offscreen documents only support `chrome.runtime` and should be managed as a thin lifecycle wrapper around messaging, not as a second application host. Source: [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen), especially the sections on concepts, usage, and lifecycle.
- Rabby's public architecture readme explicitly separates `background.js`, `content-script`, `pageProvider.js`, and `ui`, each in different contexts with narrow responsibilities. Source: [Rabby README](https://github.com/RabbyHub/Rabby), lines describing "Extension's Scripts".
- Wagmi's core/docs argue for a VanillaJS core plus framework adapters, with modular building blocks that are easy to move, replace, and tree-shake. Source: [Wagmi Core getting started](https://wagmi.sh/core/getting-started), [Why Wagmi Core](https://wagmi.sh/core/why), and the main [wagmi.sh](https://wagmi.sh/) home page.
- EIP-6963 formalized event-based provider discovery to avoid shared mutable `window.ethereum` races and namespace collisions. Source: [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963).

Inference from those sources: modern wallet codebases do better when runtime shells stay thin and reusable logic lives in framework-agnostic, transport-agnostic modules.

## Target package graph

Recommended long-term workspace layout:

1. `@nulo/wallet-core`
2. `@nulo/wallet-crypto`
3. `@nulo/aztec-runtime`
4. `@nulo/extension-messaging`
5. `@nulo/wallet-bridge`
6. `@nulo/extension-ui`
7. `packages/extension` kept as the MV3 shell only

Dependency direction should be one-way:

- `extension` shell -> `extension-ui`, `extension-messaging`, `wallet-bridge`, `aztec-runtime`, `wallet-core`, `wallet-crypto`
- `extension-ui` -> `wallet-core`, client interfaces, generated DTOs
- `wallet-bridge` -> `wallet-core`, `aztec-runtime`
- `aztec-runtime` -> `wallet-core`, `wallet-crypto`
- `extension-messaging` -> `wallet-core`
- `wallet-core` -> nothing browser-specific, nothing Vue-specific, nothing `@aztec/*`
- `wallet-crypto` -> Web Crypto only, no `chrome`, no Vue

That keeps runtime and framework code at the edges.

## Package 1: `@nulo/wallet-core`

## Responsibility

Pure domain and application logic that should run without:

- `chrome.*`
- Vue/Pinia
- `@aztec/*`
- popup windows

## Move candidates

High-confidence extractions:

- task domain and tree logic from [`packages/extension/src/wallet/services/task/service.ts`](../../packages/extension/src/wallet/services/task/service.ts)
- capability algebra from [`packages/extension/src/wallet/services/wallet-sdk/capability-map.ts`](../../packages/extension/src/wallet/services/wallet-sdk/capability-map.ts)
- scope enforcement from [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts)
- fee detection helpers from [`packages/extension/src/wallet/services/execution/utils/fee-detection.ts`](../../packages/extension/src/wallet/services/execution/utils/fee-detection.ts)
- generic utility primitives:
  - [`packages/extension/src/wallet/utils/queue.ts`](../../packages/extension/src/wallet/utils/queue.ts)
  - [`packages/extension/src/wallet/utils/event-handler.ts`](../../packages/extension/src/wallet/utils/event-handler.ts)
  - [`packages/extension/src/wallet/utils/lock.ts`](../../packages/extension/src/wallet/utils/lock.ts)
  - [`packages/extension/src/wallet/utils/rw-guard.ts`](../../packages/extension/src/wallet/utils/rw-guard.ts)

Second-wave extractions:

- operation DTOs from `execution/spec.ts`, `dapp-interaction/spec.ts`, `transaction/spec.ts`
- session/account/capability policy evaluators currently embedded in `DappInteractionService` and `WalletSdkDispatcher`
- transaction lifecycle state machines currently embedded in `ExecutionService` and `TransactionService`

## Boundary rule

`wallet-core` may define ports such as:

- `Clock`
- `Random`
- `SessionStore`
- `ProfileRepository`
- `NodePort`
- `PxePort`
- `WindowApprovalPort`

But it must not implement them with browser/Aztec details.

## Why this extraction is justified by the current code

The pure pieces are already the easiest to test:

- see [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.test.ts)
- see [`packages/extension/src/wallet/services/task/service.test.ts`](../../packages/extension/src/wallet/services/task/service.test.ts)

That is the signal that these modules belong in a framework/runtime-agnostic core.

## First extraction step

- create `src/core/` inside the extension package first
- move pure files there without changing behavior
- replace direct imports from `wallet/services/...` with `core/...`
- promote to a workspace package only after import churn stabilizes

Estimate:

- risk: low
- size: 3-5 days

## Package 2: `@nulo/wallet-crypto`

## Responsibility

All key-derivation, password/passkey cryptography, mnemonic handling, and secret material transforms.

## Move candidates

- password encryption in [`packages/extension/src/wallet/services/profile/encryption/encryption-key.ts`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts)
- passkey secret derivation in [`packages/extension/src/wallet/services/passkey/credential.ts`](../../packages/extension/src/wallet/services/passkey/credential.ts)
- mnemonic helpers in [`packages/extension/src/wallet/utils/mnemonic.ts`](../../packages/extension/src/wallet/utils/mnemonic.ts)
- random/entropy helpers from [`packages/extension/src/wallet/utils/random.ts`](../../packages/extension/src/wallet/utils/random.ts)

## Boundary rule

`wallet-crypto` may depend on:

- Web Crypto
- `Fr` conversion if unavoidable

It must not depend on:

- profile storage
- popup windows
- `chrome.*`
- service messaging

## Why this extraction is justified by the current code

The crypto code is already isolated enough to test:

- PBKDF2/AES-GCM wrapper in [`encryption-key.ts:1`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L1) through [`encryption-key.ts:116`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L116)
- passkey HKDF chain in [`credential.ts:6`](../../packages/extension/src/wallet/services/passkey/credential.ts#L6) through [`credential.ts:41`](../../packages/extension/src/wallet/services/passkey/credential.ts#L41)

The problem is that `ProfileService` still owns both crypto policy and session/storage orchestration.

## First extraction step

- extract `PasswordSecretBox`, `PasskeyMasterSecret`, and `MnemonicFactory` modules
- make `ProfileService` consume them as injected collaborators

Estimate:

- risk: low
- size: 2-4 days

## Package 3: `@nulo/aztec-runtime`

## Responsibility

Everything that genuinely belongs to the Aztec runtime boundary:

- PXE
- Aztec node access
- account contract wrappers
- contract artifact/instance handling
- Aztec transaction assembly and proof orchestration

## Move candidates

- PXE client/proxy/service:
  - [`packages/extension/src/wallet/services/pxe/client.ts`](../../packages/extension/src/wallet/services/pxe/client.ts)
  - [`packages/extension/src/wallet/services/pxe/proxy.ts`](../../packages/extension/src/wallet/services/pxe/proxy.ts)
  - [`packages/extension/src/wallet/services/pxe/service.ts`](../../packages/extension/src/wallet/services/pxe/service.ts)
- account contract adapter:
  - [`packages/extension/src/wallet/services/account/contracts/nulo-account.ts`](../../packages/extension/src/wallet/services/account/contracts/nulo-account.ts)
- token function adapters:
  - [`packages/extension/src/wallet/services/token/functions/*`](../../packages/extension/src/wallet/services/token/functions)
- node client factory currently embedded in [`packages/extension/src/wallet/services/network/service.ts:86`](../../packages/extension/src/wallet/services/network/service.ts#L86) through [`network/service.ts:89`](../../packages/extension/src/wallet/services/network/service.ts#L89) and [`network/service.ts:232`](../../packages/extension/src/wallet/services/network/service.ts#L232) through [`network/service.ts:247`](../../packages/extension/src/wallet/services/network/service.ts#L247)

## Important refinement

Do not move the entire current `ExecutionService` into `aztec-runtime`.

Instead split it into:

- `OperationPlanner` in `wallet-core`
- `AztecExecutionEngine` in `aztec-runtime`
- thin background-facing `ExecutionService` facade in the extension shell

Why: today `ExecutionService` is both planner and adapter. Keeping that shape would simply move the God class into a different package.

## Boundary rule

`aztec-runtime` may depend on `@aztec/*`, but must not know:

- popup routes
- Chrome windows
- Vue
- `chrome.storage`

The offscreen transport should also stay out of this package. Chrome's own docs make offscreen a runtime edge, not a domain layer. Source: [Chrome Offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

## First extraction step

- define `PxePort` and `NodePort` interfaces in `wallet-core`
- implement them with current PXE and node logic in `aztec-runtime`
- move only the interfaces and adapters first, not the whole execution pipeline

Estimate:

- risk: high
- size: 1-2 weeks

## Package 4: `@nulo/extension-messaging`

## Responsibility

Shared browser-extension transport/runtime primitives:

- background `Port` RPC
- offscreen `runtime.sendMessage` RPC
- message envelopes
- browser API adapters
- service composition helpers

## Move candidates

- shared service abstractions in [`packages/extension/src/wallet/base/index.ts`](../../packages/extension/src/wallet/base/index.ts)
- background transport in:
  - [`packages/extension/src/wallet/base/background/client.ts`](../../packages/extension/src/wallet/base/background/client.ts)
  - [`packages/extension/src/wallet/base/background/service.ts`](../../packages/extension/src/wallet/base/background/service.ts)
- offscreen transport in:
  - [`packages/extension/src/wallet/base/offscreen/client.ts`](../../packages/extension/src/wallet/base/offscreen/client.ts)
  - [`packages/extension/src/wallet/base/offscreen/service.ts`](../../packages/extension/src/wallet/base/offscreen/service.ts)
- message codecs and param wrappers from `wallet/base/messages`, `wallet/base/utils`
- a new `BrowserApi` adapter that centralizes `chrome.*`

## Why this extraction is justified by the current code

The current background and offscreen transports already look like a small framework:

- background client reconnect loop and pending request map in [`background/client.ts:29`](../../packages/extension/src/wallet/base/background/client.ts#L29) through [`background/client.ts:134`](../../packages/extension/src/wallet/base/background/client.ts#L134)
- background service request dispatch in [`background/service.ts:32`](../../packages/extension/src/wallet/base/background/service.ts#L32) through [`background/service.ts:136`](../../packages/extension/src/wallet/base/background/service.ts#L136)
- offscreen request timeout and routing in [`offscreen/client.ts:95`](../../packages/extension/src/wallet/base/offscreen/client.ts#L95) through [`offscreen/client.ts:126`](../../packages/extension/src/wallet/base/offscreen/client.ts#L126)
- offscreen keepalive behavior in [`offscreen/service.ts:63`](../../packages/extension/src/wallet/base/offscreen/service.ts#L63) through [`offscreen/service.ts:104`](../../packages/extension/src/wallet/base/offscreen/service.ts#L104)

That code should be reusable and contract-tested independently from wallet behavior.

## Boundary rule

`extension-messaging` may depend on `chrome.*`, but must not depend on:

- Aztec SDKs
- wallet business rules
- Vue

## First extraction step

- keep the files in-place but rename the layer mentally from "wallet/base" to "platform/messaging"
- add generic contract tests for both transports
- then promote to a workspace package

Estimate:

- risk: medium
- size: 4-6 days

## Package 5: `@nulo/wallet-bridge`

## Responsibility

dApp-facing protocol, session scoping, capability enforcement, and provider bridge logic.

## Move candidates

- wallet-sdk bridge logic:
  - [`packages/extension/src/wallet/services/wallet-sdk/background.ts`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts)
  - [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts)
  - [`packages/extension/src/wallet/services/wallet-sdk/capability-map.ts`](../../packages/extension/src/wallet/services/wallet-sdk/capability-map.ts)
  - [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts)
  - [`packages/extension/src/wallet/services/wallet-sdk/types.ts`](../../packages/extension/src/wallet/services/wallet-sdk/types.ts)
- dApp session models and grants from [`packages/extension/src/wallet/services/dapp-session`](../../packages/extension/src/wallet/services/dapp-session)
- content-script shell should stay in `packages/extension`, but it should call into this package

## Why this extraction is justified by the current code

`WalletSdkDispatcher` is already a translator layer:

- method-to-operation mapping in [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts:95`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L95) through [`dispatcher.ts:150`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L150)
- dispatch flow in [`dispatcher.ts:173`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L173) through [`dispatcher.ts:205`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L205)

`capability-map.ts` and `scope-enforcement.ts` are also already pure bridge logic.

This package should become the protocol boundary between dApps and wallet application services.

## Design note

If the team ever wants broader multi-wallet interoperability, align this bridge with EIP-6963's principles even if Aztec's SDK remains the transport:

- immutable wallet announcements
- explicit wallet identity metadata
- event-oriented discovery rather than global mutable singleton injection

That is an inference from [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963), not a statement that Nulo must expose EIP-1193 itself.

## First extraction step

- separate pure capability/session logic from Chrome and popup opening
- keep the `BackgroundConnectionHandler` wiring in the extension shell
- move only the dispatcher, capability policy, and session DTOs first

Estimate:

- risk: medium
- size: 4-7 days

## Package 6: `@nulo/extension-ui`

## Responsibility

All Vue-specific code:

- pages
- windows
- components
- stores
- route guards
- injected service clients

## Move candidates

- `src/popup/**/*`
- `src/stores/**/*`
- popup composables

But only after removing global singleton coupling from [`packages/extension/src/utils/core.js`](../../packages/extension/src/utils/core.js).

## Boundary rule

`extension-ui` should depend on:

- domain DTOs
- client interfaces
- injected service registry

It should not import:

- background service implementations
- `chrome.*` directly except through a tiny UI platform facade

## Why this extraction is justified by the current code

`App.vue` currently combines:

- settings bootstrap
- profile loading
- account/network initialization
- transaction subscription wiring

in [`packages/extension/src/popup/app.vue:42`](../../packages/extension/src/popup/app.vue#L42) through [`popup/app.vue:260`](../../packages/extension/src/popup/app.vue#L260).

That logic belongs in composables and injected application services, not in the root component.

## First extraction step

- create a `UiRuntime` plugin object
- inject service clients instead of importing `utils/core.js`
- split `App.vue` bootstrap into composables:
  - `useSettingsBootstrap`
  - `useProfileSession`
  - `useNetworkSelection`
  - `useTransactionSubscription`

Estimate:

- risk: medium
- size: 4-6 days

## What stays in `packages/extension`

The extension package should remain as the MV3 shell:

- [`packages/extension/src/wallet/index.ts`](../../packages/extension/src/wallet/index.ts)
- [`packages/extension/src/offscreen/index.ts`](../../packages/extension/src/offscreen/index.ts)
- [`packages/extension/src/content-script/content.ts`](../../packages/extension/src/content-script/content.ts)
- [`packages/extension/src/popup/index.ts`](../../packages/extension/src/popup/index.ts)
- manifest and build config

These files should become thin composition roots only.

That mirrors the pattern documented by Rabby, where background, content-script, injected page code, and UI are explicit shells in different contexts. Source: [Rabby README](https://github.com/RabbyHub/Rabby).

## Anti-goals

Avoid these traps:

1. Do not move whole services into packages without splitting their responsibilities first.
`ExecutionService` and `ProfileService` need decomposition before extraction.

2. Do not let `chrome.*` leak into new packages.
That would just freeze current coupling into the workspace graph.

3. Do not make Vue stores the new domain core.
Pinia should adapt application state, not own business rules.

4. Do not put offscreen lifecycle in the Aztec package.
Chrome documents offscreen as a runtime-limited document managed through `chrome.runtime`; keep it in the extension platform layer.

## Recommended extraction order

1. Create internal boundaries first:
`core`, `crypto`, `platform/messaging`, `bridge`, `ui-runtime`, `aztec-runtime`.
Risk: low.
Size: 3-5 days.

2. Replace direct `chrome.*` usage with `BrowserApi` ports.
Risk: medium.
Size: 3-5 days.

3. Split `ExecutionService` into planner plus engine.
Risk: high.
Size: 1-2 weeks.

4. Split `ProfileService` into repository, crypto, passkey, and session modules.
Risk: high.
Size: 1-2 weeks.

5. Promote the stabilized internal layers into Bun workspace packages.
Risk: medium.
Size: 4-7 days.

## Bottom line

The modularization opportunity is not "extension to many packages". It is:

- thin MV3 shells
- pure core logic
- dedicated crypto modules
- dedicated Aztec adapters
- dedicated extension messaging/platform adapters
- a UI layer that consumes services instead of booting them

If the team follows that order, package extraction becomes a byproduct of good boundaries instead of a risky rewrite disguised as organization.
