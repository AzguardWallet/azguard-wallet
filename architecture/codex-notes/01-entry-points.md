# 01 Entry Points

## Scope

This note maps the real MV3 runtime surfaces under `packages/extension/src/` and identifies which execution context owns which responsibilities. It is based on the manifest, Vite entry configuration, and the runtime bootstrap files themselves.

## Declared extension entry points

The Chrome manifest declares three browser-managed entry points and one shared UI surface:

| Surface | Manifest / build hook | Runtime file | What it owns today |
| --- | --- | --- | --- |
| Service worker | `background.service_worker` in [`packages/extension/manifest/manifest.config.ts:18`](../../packages/extension/manifest/manifest.config.ts#L18) | [`packages/extension/src/wallet/index.ts`](../../packages/extension/src/wallet/index.ts#L1) | All wallet business logic, storage migration, Aztec service graph, wallet-sdk background handler |
| Popup | `action.default_popup` in [`manifest.config.ts:15`](../../packages/extension/manifest/manifest.config.ts#L15) | [`packages/extension/src/popup/index.ts`](../../packages/extension/src/popup/index.ts#L1) | Main Vue app for user-facing flows |
| Side panel | `side_panel.default_path` in [`manifest.config.ts:22`](../../packages/extension/manifest/manifest.config.ts#L22) | same [`src/popup/index.ts`](../../packages/extension/src/popup/index.ts#L1) bundle | Reuses the popup app with different chrome container semantics |
| Content script | `content_scripts[].js` in [`manifest.config.ts:25`](../../packages/extension/manifest/manifest.config.ts#L25) | [`packages/extension/src/content-script/content.ts`](../../packages/extension/src/content-script/content.ts#L1) | Relay between page and background for the Aztec wallet SDK |

The offscreen document is **not** a manifest entry. It is a build input in Vite at [`packages/extension/vite.config.ts:177`](../../packages/extension/vite.config.ts#L177) and is created lazily by the service worker through the offscreen API in [`packages/extension/src/wallet/utils/offscreen.ts:101`](../../packages/extension/src/wallet/utils/offscreen.ts#L101).

## Service worker

The service worker is the real process root of the wallet.

- It installs global error/log hooks, sets the uninstall URL, and rehydrates logs before anything else in [`src/wallet/index.ts:34`](../../packages/extension/src/wallet/index.ts#L34) and [`src/wallet/index.ts:117`](../../packages/extension/src/wallet/index.ts#L117).
- It initializes config and Barretenberg in parallel in [`src/wallet/index.ts:74`](../../packages/extension/src/wallet/index.ts#L74).
- It runs storage migration before service startup in [`src/wallet/index.ts:77`](../../packages/extension/src/wallet/index.ts#L77).
- It registers the entire wallet service graph in one place in [`src/wallet/index.ts:79`](../../packages/extension/src/wallet/index.ts#L79) through [`src/wallet/index.ts:97`](../../packages/extension/src/wallet/index.ts#L97).
- It starts all services concurrently via `ServiceCollection.start()` which is just `Promise.all(...)` in [`src/wallet/base/index.ts:43`](../../packages/extension/src/wallet/base/index.ts#L43).
- It then installs the wallet-sdk background handler in [`src/wallet/index.ts:102`](../../packages/extension/src/wallet/index.ts#L102).
- It writes a session heartbeat every 10 seconds to `chrome.storage.session` in [`src/wallet/index.ts:106`](../../packages/extension/src/wallet/index.ts#L106).

### What lives here

Today, essentially all privileged logic lives in the worker:

- account/profile/network/config persistence
- unlock state and passkey flows
- transaction construction/execution
- dapp approvals and sessions
- token balances, contacts, notes, account state, auth registry, task tracking
- the bridge to offscreen PXE

Architecturally this is a thick background kernel, not a thin message router.

## Popup, side panel, and approval windows

The popup app is one Vue entry bundle reused for three UX modes:

1. Browser action popup via `default_popup`
2. Side panel via `side_panel.default_path`
3. Standalone popup windows opened programmatically for approvals

Evidence:

- The Vite pages plugin mounts `src/popup/pages` under `popup` and `src/popup/windows` under `windows` in [`vite.config.ts:89`](../../packages/extension/vite.config.ts#L89) through [`vite.config.ts:104`](../../packages/extension/vite.config.ts#L104).
- `DappInteractionService` opens approval windows at `src/popup/index.html#/windows/${type}` in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:173`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L173).
- The router bootstraps once in [`packages/extension/src/popup/index.ts:51`](../../packages/extension/src/popup/index.ts#L51) and applies auth/profile guards across all routes in [`src/popup/index.ts:56`](../../packages/extension/src/popup/index.ts#L56).

### What lives here

- Vue 3 application shell and route orchestration
- Pinia stores
- user interaction and confirmation UIs
- thin service-client calls back to the worker
- log forwarding to the worker through `LoggerServiceClient` in [`src/popup/index.ts:1`](../../packages/extension/src/popup/index.ts#L1) and [`packages/extension/src/wallet/services/logger/client.ts:8`](../../packages/extension/src/wallet/services/logger/client.ts#L8)

### Important boundary detail

The popup process also owns a module-level singleton `managers` object in [`packages/extension/src/utils/core.js:22`](../../packages/extension/src/utils/core.js#L22). That object eagerly connects a `ProfileServiceClient`, eagerly connects a `ContactServiceClient`, and mutates shared references for `network` and `transaction`. This is an application-global client registry, not route-local state.

That is workable, but it means the popup bundle is already carrying process-wide mutable state outside Pinia before any page renders.

## Content script

The local content script is intentionally thin:

- It imports `ContentScriptConnectionHandler` from `@aztec/wallet-sdk/extension/handlers` in [`src/content-script/content.ts:9`](../../packages/extension/src/content-script/content.ts#L9).
- It forwards messages to the worker with `chrome.runtime.sendMessage` in [`src/content-script/content.ts:12`](../../packages/extension/src/content-script/content.ts#L12).
- It subscribes to worker messages and hands them back to the handler in [`src/content-script/content.ts:13`](../../packages/extension/src/content-script/content.ts#L13).

Notably, there is no local in-page provider injection logic in `src/`. That behavior appears to be encapsulated by the external wallet-sdk package. That is a valid design choice, but it means part of the runtime architecture is outsourced and not visible in this package’s source tree.

## Offscreen PXE document

The offscreen document is a fourth execution context, but one controlled by the worker rather than the browser manifest.

- `ensureOffscreenRunning()` checks for an existing offscreen context, health-checks it via `PING/PONG`, kills zombie documents, and creates a new one if needed in [`src/wallet/utils/offscreen.ts:101`](../../packages/extension/src/wallet/utils/offscreen.ts#L101).
- The offscreen entry only starts `PxeService` in [`packages/extension/src/offscreen/index.ts:37`](../../packages/extension/src/offscreen/index.ts#L37) through [`src/offscreen/index.ts:39`](../../packages/extension/src/offscreen/index.ts#L39).
- It announces readiness only after service startup in [`src/offscreen/index.ts:42`](../../packages/extension/src/offscreen/index.ts#L42).
- It also forwards logs back to the worker using `LoggerServiceClient("offscreen")` in [`src/offscreen/index.ts:18`](../../packages/extension/src/offscreen/index.ts#L18).

### What lives here

- PXE runtime
- browser-incompatible or long-lived proof-related work isolated from the service worker
- health-checked offscreen lifecycle owned by the worker

This is the cleanest execution boundary in the codebase: one context, one service, one reason to exist.

## Dormant setup app

There is also a built `src/setup/index.html` / `src/setup/index.ts` entry in Vite at [`vite.config.ts:179`](../../packages/extension/vite.config.ts#L179), but the install/update flow that would open it is commented out in the worker at [`src/wallet/index.ts:46`](../../packages/extension/src/wallet/index.ts#L46).

So today:

- the setup app is shipped
- it is not an active extension entry point
- install/update onboarding is effectively disabled

## Architectural read

### What is good

- Runtime responsibilities are mostly sensible: worker for privileged state, offscreen for PXE, content script as relay, popup for UI.
- Offscreen lifecycle is treated as failure-prone and explicitly health-checked. That is strong MV3 hygiene.
- Approval flows reuse the main popup bundle instead of inventing a second UI stack.

### Current structural pressure points

1. The worker is a God-process bootstrap. It directly constructs every service and knows every concrete type in [`src/wallet/index.ts:79`](../../packages/extension/src/wallet/index.ts#L79).
2. Popup, side panel, and approval windows all share one app entry and route graph. That reduces duplication, but it also mixes three UX shells with different lifecycle and security expectations.
3. Popup-global mutable service clients live outside the store layer in [`src/utils/core.js:14`](../../packages/extension/src/utils/core.js#L14). This makes UI behavior harder to isolate in unit tests.
4. Part of the page bridge architecture is hidden inside `@aztec/wallet-sdk`, so local reasoning about end-to-end injection is incomplete unless that dependency is read too.
5. `ServiceCollection.start()` is fully concurrent. Any service relying on another service being already started is depending on undocumented startup ordering.

## Recommendations flowing from this concern

These are entry-point-specific recommendations; broader modularization comes later.

1. Split popup shells by intent, not only by route.
Estimate: medium, days.
Create explicit app boot modes for browser popup, side panel, and approval window so each can register only the stores, guards, and subscriptions it needs.

2. Replace `src/utils/core.js` singletons with an injected UI service gateway.
Estimate: medium, days.
This would make popup routes and composables testable without a live worker port.

3. Introduce a declarative service bootstrap manifest for the worker.
Estimate: medium, days.
Keep one file listing services, but move dependency wiring and startup semantics out of `src/wallet/index.ts`.

4. Treat the offscreen boundary as a package seam.
Estimate: low, hours to days.
The current separation is already good; formalizing it as a `pxe-client` / `pxe-runtime` boundary would preserve one of the healthiest parts of the architecture.

5. Document the external wallet-sdk bridge as part of the local architecture.
Estimate: low, hours.
Right now the extension’s page bridge is partly implicit because the critical injection logic is outside this repository subtree.
