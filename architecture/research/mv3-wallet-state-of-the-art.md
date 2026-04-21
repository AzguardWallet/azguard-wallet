# MV3 Wallet Extensions: State of the Art (2024–2026)

Research dossier for the Vibeguard/Nulo refactor. The brief:
we are a Vue 3 + MV3 + PXE (Aztec private execution) Chrome/Firefox wallet,
and we want concrete reference points before we redesign the package boundaries,
test harness, and DI story. This is a *benchmarking* document — what the rest of the
ecosystem does, with citations. The "borrowable patterns" list at the end is the
actionable output.

Research window: ~45 min, 15 web queries, spot‑fetches of a handful of primary sources.

---

## 1. MV3 Wallet Architectural Patterns

### 1.1 The MV3 service‑worker lifecycle — what every wallet has to solve

Chrome's MV3 SW lifecycle is the central constraint every extension wallet has to
design around:

- Terminated after **~30s of inactivity** (timer reset by incoming events / API calls).
- Killed if one event/API call exceeds **5 min**.
- Killed if a `fetch` response takes >30s.
- Cannot be kept alive indefinitely — `chrome.alarms` minimum period was lowered to
  30s in Chrome 120 specifically to make the lifecycle survivable.
- Things that *do* extend life: active WebSocket (Chrome 116+), open
  long‑lived ports (Chrome 114+), offscreen‑document messages (Chrome 109+),
  native messaging (Chrome 105+), debugger sessions (Chrome 118+).
- Official guidance: **don't try to keep it alive** — persist to `chrome.storage` or
  IndexedDB and make startup idempotent.

Sources: [Chrome SW lifecycle docs](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [Chromium-extensions group discussion on alarms](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE), [Medium write-up on keepalive hacks](https://medium.com/@dzianisv/vibe-engineering-mv3-service-worker-keepalive-how-chrome-keeps-killing-our-ai-agent-9fba3bebdc5b).

MetaMask explicitly hit this when migrating and has multiple long-running issues:
service-worker restart breaks the popup connection ([#16554](https://github.com/MetaMask/metamask-extension/issues/16554)),
idle SW stops responding ([#14049](https://github.com/MetaMask/metamask-extension/issues/14049)),
SW restart crashes the app ([#18244](https://github.com/MetaMask/metamask-extension/issues/18244)),
forced SW stop throws "Duplicate script ID 'inpage'" ([#24514](https://github.com/MetaMask/metamask-extension/issues/24514)).
The common theme: **reconnect logic between popup and SW is the hardest part of MV3**,
not the SW itself.

### 1.2 Offscreen documents — the crypto / WASM / DOM escape hatch

Offscreen documents are hidden HTML pages the extension can open to regain a full
DOM + looser CSP. They are the standard escape hatch for:

- WebAssembly crypto that needs `wasm-unsafe-eval` ([Chromium extensions thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/sJiaTnFMLHQ), [Chrome Status](https://chromestatus.com/feature/5453022515691520)).
- Long-lived connections (they also act as a SW keepalive vector — messages from
  offscreen reset the SW idle timer, Chrome 109+).
- Hardware-wallet bridges. MetaMask's Ledger integration *still* uses an iframe
  loaded from github.io (served over HTTPS) because U2F-era Ledger transport
  requires an SSL iframe — the bridge pattern predates offscreen docs but maps onto
  them 1:1 today. See [`eth-ledger-bridge-keyring`](https://github.com/MetaMask/eth-ledger-bridge-keyring).

**Constraint:** Chrome allows **only one offscreen document at a time**. MetaMask
has hit this — [#25118](https://github.com/MetaMask/metamask-extension/issues/25118).
You either multiplex everything through one document or tear down and re-open.

### 1.3 Content script ↔ background ↔ in‑page provider bus

The canonical pattern, established by MetaMask's [`@metamask/providers`](https://github.com/MetaMask/providers) and copied by every EVM wallet:

```
 dApp page            │  content script          │  background SW
 ─────────────────────┼──────────────────────────┼──────────────────────
 window.ethereum      │  relay via runtime port  │  JsonRpcEngine + 
   ↕ postMessage      │   ↕ postMessage          │   middleware stack
 inpage.js script     │  contentscript.js        │  providerController
```

Concrete mechanics (from [`inpage.js`](https://github.com/MetaMask/metamask-extension/blob/master/app/scripts/inpage.js) and Rabby's structure):

- Inpage script uses `WindowPostMessageStream({ name: 'metamask-inpage', target: 'metamask-contentscript' })`.
- Content script uses `chrome.runtime.connect()` to hold a long-lived port to the SW.
- Streams are multiplexed with [`obj-multiplex`](https://www.npmjs.com/package/@metamask/object-multiplex)
  so a single stream carries both provider RPC and publish/subscribe event channels.
- Rabby reuses the same topology: `content-script` gets the message via `runtime.connect`,
  hands it to `providerController`, which stashes the port in `sessionService` for
  later events ([Rabby README](https://github.com/RabbyHub/Rabby)).

**EIP-6963** is the modern answer to the "last wallet to inject wins" race —
every major wallet now emits `eip6963:announceProvider` events instead of just
clobbering `window.ethereum`. MetaMask's reference implementation: [vite-react-ts-eip-6963](https://github.com/MetaMask/vite-react-ts-eip-6963).
Spec: [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963).
For an Aztec wallet this is aspirational — there's no equivalent canonical
provider-discovery standard yet in the Aztec ecosystem, though the Aztec wallet-sdk
does play in the same space.

### 1.4 State management across processes

Three dominant patterns surfaced, in rough order of popularity:

1. **Redux + `chrome.storage` as a single source of truth** (MetaMask, older Rainbow).
   Popup opens, it sync-rehydrates from storage, then dispatches over a runtime port
   back to a reducer that lives in the SW. See [thoughtbot's write-up](https://thoughtbot.com/blog/redux-for-chrome-extensions)
   and [Drew Althage's Medium post on stale-while-refresh Redux](https://medium.com/@drewalth/build-chrome-extensions-with-react-and-redux-using-the-stale-while-refresh-approach-b8c791ec9ca0).

2. **Zustand + chrome-storage subscribe** — each context instantiates its own store,
   Chrome Storage is the sync bus. See [Drew Althage's Zustand+chrome-storage lab](https://www.drewalth.com/lab/zustand-chrome-storage/)
   and [`@webext-pegasus/store-zustand`](https://www.npmjs.com/package/@webext-pegasus/store-zustand).
   Discussion on this pattern: [zustand #2020](https://github.com/pmndrs/zustand/discussions/2020).

3. **Typed RPC clients** over `runtime.connect` (what Vibeguard already does, what
   Rainbow does). Each service has a client counterpart that replays calls over a
   port. No shared store — the client is a thin proxy.

The Taboola engineering blog has a good "beyond Redux post-MV3" piece walking
through the pros/cons: [Optimising Chrome Extensions Part 1](https://medium.com/@byeduardoac/optimising-chrome-extensions-part-1-beyond-redux-post-manifest-v3-c4e04d509264)
and [Part 2](https://www.taboola.com/engineering/optimising-chrome-extensions-part-2/).

### 1.5 Package splits — how MetaMask slices its domain

MetaMask's [`core`](https://github.com/MetaMask/core) monorepo is the canonical
example of deep package decomposition in a wallet. Structure roughly:

**Foundation layer**
- `@metamask/base-controller` — the Controller base class with state + events.
- `@metamask/messenger` — typed pub/sub + request/response between controllers.
- `@metamask/json-rpc-engine` — composable middleware pipeline.
- `@metamask/storage-service`, `base-data-service`, `authenticated-user-storage`.

**Controllers (composed on top)**
- Accounts: `keyring-controller`, `accounts-controller`, `account-tree-controller`.
- Network: `network-controller`, `eth-json-rpc-middleware`, `eth-block-tracker`.
- Assets/txs: `transaction-controller`, `assets-controller`, `gas-fee-controller`.
- Permissions/approvals: `permission-controller`, `approval-controller`, `phishing-controller`.
- User-facing: `preferences-controller`, `address-book-controller`, `ens-controller`.

Controllers communicate **exclusively through the messenger** — no direct imports
between controller classes. Higher-level controllers (like `transaction-controller`)
messenger-subscribe to lower-level ones (`gas-fee-controller`, `network-controller`)
rather than taking them as constructor deps. This is close to a hexagonal
architecture with the messenger acting as the event bus port. Documented briefly in
[metamask-extension AGENTS.md](https://github.com/MetaMask/metamask-extension/blob/main/AGENTS.md).

### 1.6 JSON-RPC middleware stack

MetaMask's [`json-rpc-engine`](https://github.com/MetaMask/json-rpc-engine) is a
textbook middleware pattern. Each middleware gets `(req, res, next, end)`;
`next(returnHandler)` passes down the stack with an optional post-processing hook.
Engines can be nested via `engine.asMiddleware()`. This is what lets MetaMask
swap the full pipeline cleanly — phishing check → permission check → network
selection → signing — while keeping each step independently testable.

`rpc-cap` / `json-rpc-capabilities-middleware` adds capability-based
permissions on top of the engine — the same pattern that powers Snaps'
`endowment:rpc` permission model. See [Snaps permissions docs](https://docs.metamask.io/snaps/reference/permissions/)
and the [DeepWiki permission system page](https://deepwiki.com/MetaMask/snaps/3.1-permission-system).

### 1.7 Snaps execution environment — sandboxing third-party code

MetaMask Snaps runs untrusted plugin code in:

1. A `sandbox`-attribute iframe (so outgoing requests carry `Origin: null`).
2. Under [SES](https://github.com/endojs/endo/tree/master/packages/ses) (Secure ECMAScript)
   with `lockdown()` called to freeze prototypes and prevent prototype pollution.
3. Per-plugin Compartments that reshape `globalThis` to only expose allow-listed APIs.
4. A capability-based permission manifest (`endowment:*`).

Write-ups: [osec.io deep dive](https://osec.io/blog/2023-11-01-metamask-snaps/),
[MetaMask Snaps execution env docs](https://docs.metamask.io/snaps/learn/about-snaps/execution-environment/),
[iframe-execution-environment repo](https://github.com/MetaMask/iframe-execution-environment).

This is *massive* overkill for Vibeguard — we don't run third-party code — but the
Compartment + lockdown pattern is borrowable for isolating the PXE runtime from
the popup UI.

### 1.8 LavaMoat — build-time + runtime dependency isolation

MetaMask, Rainbow, and a growing list of others use [LavaMoat](https://github.com/LavaMoat/LavaMoat)
for supply-chain defence. Three layers:

- **Install** — `@lavamoat/allow-scripts` / `preinstall-always-fail` disable
  arbitrary lifecycle scripts.
- **Build** — bundles the dependency graph into Compartments so each package
  only sees the globals + imports declared in a policy file.
- **Runtime** — that policy is enforced in the browser.

Relevant reading: [MetaMask's "using LavaMoat"](https://metamask.io/news/using-lavamoat-to-solve-software-supply-chain-security),
[2024 vulnerability disclosure + fix](https://osec.io/blog/2024-06-10-supply-chain-attacks-a-new-era/),
[MetaMask security monthly Nov 2024](https://metamask.io/news/security/metamask-security-report-november-2024/).

Rainbow adopted it too — listed as a security tool in their extension. The 2024
vuln is worth internalising: **supply-chain isolation at *build* time is not
enough if an attacker controls the bundler input** — MetaMask added `assertValidJS`
as an independent AST check.

### 1.9 Other wallets — quick notes

- **Rainbow** ([`rainbow-me/browser-extension`](https://github.com/rainbow-me/browser-extension)):
  one of the earliest MV3 wallets. Webpack + Vitest + Foundry for some e2e.
  Uses LavaMoat. TypeScript 99.1%. Has `e2e/` dir. Webpack split across
  `webpack.config.js` / `webpack.config.dev.js`.
- **Rabby** ([`RabbyHub/Rabby`](https://github.com/RabbyHub/Rabby)): same
  providerController + sessionService topology as MetaMask. Standard MV2/MV3
  content-script + background split.
- **Phantom**: closed source, but documented feature set — AES-GCM for
  storage, local-only key material, hardware-wallet passthrough, tx simulation
  on approvals. They ship a [`@phantom/browser-sdk`](https://www.npmjs.com/package/@phantom/browser-sdk)
  for the injected-provider surface.
- **Coinbase Wallet**: largely closed-source for the extension; the
  [`coinbase-wallet-sdk`](https://github.com/coinbase/coinbase-wallet-sdk)
  is the dApp-facing side and doesn't reveal the extension internals.

---

## 2. Testing Strategies

### 2.1 Unit tests: Vitest wins, but you need a browser-API fake

The community consensus for extension unit tests in 2025:

- **Vitest** over Jest — faster, native ESM, better Vite integration, WXT ships
  an official `WxtVitest` plugin.
- Mock `browser`/`chrome` with [**`@webext-core/fake-browser`**](https://webext-core.aklinker1.io/fake-browser/installation).
  Crucially it **implements `storage` in-memory as a real state machine**, so you
  test behaviour not mock call counts. WXT integrates this automatically — see
  [WXT unit testing docs](https://wxt.dev/guide/essentials/unit-testing).
- Alternatives: [`vitest-chrome`](https://github.com/probil/vitest-chrome)
  (full sinon-stub API, no state), [`mockzilla-webextension`](https://github.com/lusito/mockzilla-webextension)
  (typed, mock-per-test), `sinon-chrome`. See [Vitest discussion #3090](https://github.com/vitest-dev/vitest/discussions/3090).
- If you import modules that internally `require('webextension-polyfill')`, you
  need to add them to `ssr.noExternal` or the setup file will complain
  "This script should only be loaded in a browser extension"
  ([Vitest #5347](https://github.com/vitest-dev/vitest/issues/5347)).

### 2.2 E2E: Puppeteer vs Playwright for MV3 extensions

Both work, both have gotchas. Playwright has slightly better docs these days:

- **Playwright** ([official docs](https://playwright.dev/docs/chrome-extensions))
  requires `launchPersistentContext` with a channel='chromium' and
  `--disable-extensions-except` + `--load-extension` flags.
  Can enumerate service workers via `context.serviceWorkers()` and waits via
  `context.waitForEvent('serviceworker')`. Playwright **keeps the same Worker
  object alive across SW suspend/restart** — no new event emitted.
  [Template repo](https://github.com/kelseyaubrecht/playwright-chrome-extension-testing-template).
- **Puppeteer** ([docs](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer),
  [lifecycle testing](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)):
  has a dedicated Chrome for Developers page on MV3 SW termination testing.
  Puppeteer #11775 added `Worker.close()` specifically to let tests kill the SW.
- **Side panel** is still painful in both — [Playwright #26693](https://github.com/microsoft/playwright/issues/26693)
  requests a feature that isn't yet landed.
- **eyeo's case study** of migrating MV3 tests is the single best write-up:
  [Chrome blog — eyeo's journey](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension).
- **Popup testing** workaround: open it from the SW via
  `chrome.action.openPopup()`, then wait for a target ending in `popup.html`
  ([Oliver Dunk](https://oliverdunk.com/2022/11/13/extensions-puppeteer-popup-testing)).

**Known limitation for both:** extensions only work in headed Chrome — headless
(legacy) doesn't load them; `--headless=new` does, but many CI runners still
don't have a display server by default.

### 2.3 Framework comparison — WXT vs Plasmo vs CRXJS

Summarised from multiple 2025/2026 comparisons
([redreamality 2025](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/),
[DevKit comparison](https://www.devkit.best/blog/mdx/chrome-extension-framework-comparison-2025),
[Jetwriter migration](https://jetwriter.ai/blog/migrate-plasmo-to-wxt),
[WXT docs/compare](https://wxt.dev/guide/resources/compare)):

| Framework | Bundler | Framework support | Bundle size | Status |
|-----------|---------|-------------------|-------------|--------|
| **WXT**   | Vite    | Vue, React, Svelte, Solid first-class | ~400 KB (ref app) | Actively maintained, growing |
| **Plasmo**| Parcel  | React-first       | ~800 KB (same app, ~43% larger) | Maintenance concerns flagged |
| **CRXJS** (vite-plugin-web-extension) | Vite | Framework-agnostic | Smallest | Lowest-level, least opinionated |

Headline: **WXT is the recommended default in 2025**; it also ships the best
Vitest story out of the box via `@webext-core/fake-browser`.

### 2.4 WebAuthn / Passkey testing

Two mature approaches:

1. **CDP `WebAuthn.addVirtualAuthenticator`** ([CDP WebAuthn domain](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)).
   Both Puppeteer and Playwright can drive it. Playwright recipe:
   [Corbado passkeys e2e](https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator).
2. **Chrome DevTools WebAuthn panel** for manual testing —
   [docs](https://developer.chrome.com/docs/devtools/webauthn/).

Given Vibeguard already uses passkeys (see CLAUDE memory on passkey flows),
the CDP virtual authenticator is the right answer for E2E. Key parameters to
pin: `protocol: 'ctap2'`, `transport: 'internal'`, `hasUserVerification: true`,
`isUserVerified: true`.

### 2.5 SW lifecycle simulation in tests

You need to test **cold start, warm start, and mid-request suspend**:

- Puppeteer recipe: [test-serviceworker-termination-with-puppeteer](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
  drives `chrome://serviceworker-internals` via CDP to force termination.
- eyeo's post ([link above](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension))
  walks through their migration — the key takeaway is **test SW suspend
  explicitly**, don't assume natural idle will trigger it in CI.
- Playwright: `worker.evaluate(() => chrome.runtime.reload())` works, but
  there's no built-in "force suspend".

### 2.6 In-tab integration tests without a real browser

This has *not* been solved cleanly for wallets. Options seen:

- **Vitest Browser Mode** ([docs](https://vitest.dev/guide/browser/)) — runs
  tests in a real headless browser via Playwright. Doesn't load extensions but
  is great for testing the popup Vue tree with a real DOM.
- **jsdom** + `@webext-core/fake-browser` — fast but no real rendering.
- **Happy-dom** — faster than jsdom, same limitations.

For wallet code, Vitest + fake-browser covers ~80% of logic; E2E with Puppeteer
covers the remaining 20% that depends on actual extension contexts and popup
rendering.

---

## 3. TypeScript Patterns for Testability

### 3.1 Dependency injection — what the ecosystem picks

Comparison sources: [npm-compare awilix/inversify/tsyringe/typedi](https://npm-compare.com/awilix,inversify,tsyringe,typedi),
[Medium: simplifying DI with container libs](https://medium.com/@ruben.alapont/simplifying-dependency-management-in-node-js-with-container-libraries-cf5e96b7e12a).

| Library | Decorators | Needs `reflect-metadata` | Notes |
|---------|-----------|--------------------------|-------|
| **tsyringe** | Yes | No | Microsoft-maintained, smallest setup. Sweet spot for FE. |
| **inversify** | Yes | Yes | Largest feature surface; enterprise. Extra tsconfig flags. |
| **awilix** | **No** | No | Function / factory registration. Node-flavoured but works in browser. |
| **typedi** | Yes | Yes | Losing market share in 2024–2025. |

For an extension codebase, the recommendations cluster around:

- **tsyringe** — if you want decorators + low overhead.
- **awilix** — if you want DI without decorators / `emitDecoratorMetadata`.
- **Plain constructor injection** — 80/20 solution; a hand-rolled
  `createContainer()` factory returning `{ services: {...}, dispose() }`
  is often enough for ~20 services.

**Note:** Neither MetaMask nor Rainbow use a DI container. MetaMask uses the
messenger + controller constructor-injection pattern; Rainbow uses module-scoped
singletons. The DI question is more about *testability* than scale.

### 3.2 Hexagonal / ports-and-adapters in extensions

Not a lot of wallet-specific write-ups, but the pattern maps cleanly:

- **Domain** = wallet core (accounts, signing, tx lifecycle).
- **Ports** (interfaces owned by domain):
  - `StoragePort` — `get/set/delete/subscribe`
  - `NetworkPort` — JSON-RPC to PXE / node
  - `CryptoPort` — sign / derive / verify
  - `UIPort` — approval requests, toast notifications
  - `ClockPort` — timers, idle detection
- **Adapters**:
  - `ChromeStorageAdapter` wraps `chrome.storage.local`
  - `InMemoryStorageAdapter` for tests
  - `PxeNetworkAdapter` wraps the offscreen-document PXE client
  - `WebAuthnCryptoAdapter` vs `EnvelopeCryptoAdapter` (password-derived)

The domain never imports `chrome.*`; only the adapters do. This is how you get
the [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)
story to *just work* — you don't mock at the `chrome.*` layer, you swap the adapter.

General reading: [Hexagonal Architecture (Wikipedia)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)),
[AWS Prescriptive Guidance — Hexagonal pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/hexagonal-architecture.html).

### 3.3 Seams for chrome.* APIs

Three seam strategies, in increasing isolation:

1. **Direct mock** (`vi.mock('webextension-polyfill')`). Brittle.
2. **Fake-browser injection** at the global level. Works for top-level code.
3. **Port/adapter** — inject `StoragePort` into each service constructor.
   Tests wire an in-memory adapter; production wires the Chrome one.

The third is what scales. Vibeguard already has seams via `EntityStorage` /
`ValueStorage` abstractions (`packages/extension/src/wallet/storage/`) — those
are ports in all but name. Formalising them as interfaces + factory-injected
adapters would unlock most of the testability wins.

### 3.4 Mutation testing with Stryker — is it worth it?

Short answer: **yes, but scoped.** Full-codebase mutation testing is too slow
(tens of minutes), but Stryker's **incremental mode** targets only changed files
([Stryker Mutator homepage](https://stryker-mutator.io/), [TypeScript checker](https://stryker-mutator.io/docs/stryker-js/typescript-checker/)).
The strong claim from 2025/2026 posts ([prodsens.live](https://prodsens.live/2026/02/01/the-pitfalls-of-test-coverage-introducing-mutation-testing-with-stryker-and-cosmic-ray/),
[typescript.tv](https://typescript.tv/testing/boost-your-typescript-tests-with-mutation-testing/)) is that **coverage lies, mutation score tells the truth** —
95% coverage with 40% mutation score is common.

Strategic adoption: apply to `wallet/services/account/*`, `wallet/services/transaction/*`,
and any crypto code. Skip Vue components.

---

## 4. Wallet-Specific Concerns

### 4.1 Key material isolation

Nobody has fully solved this in a browser extension — the JavaScript heap is
flat. Best practices observed:

- **Offscreen document as a "crypto process"** — decrypted keys live only in
  the offscreen document; the popup and SW talk to it over ports and get signed
  artifacts back, never raw secrets. (This is essentially what MetaMask's
  Ledger iframe does, generalised.)
- **AES-GCM vault** at rest, unlocked via password-derived key (scrypt/argon2).
  Phantom documents doing this; MetaMask's `keyring-controller` does this via
  [`browser-passworder`](https://github.com/MetaMask/browser-passworder).
- **Zeroize-on-lock** — explicitly null out + GC hint when the wallet locks.
  Bitcoin Core has documented [partial-password-in-memory issues](https://github.com/bitcoin/bitcoin/issues/6924)
  from not doing this carefully.
- **Compartments via SES lockdown** (as Snaps does). Prevents a compromised
  module from reading private fields via prototype pollution.

For Vibeguard: the PXE offscreen doc is already a natural home for signing
material. The pattern to codify: **secrets enter the offscreen document once
on unlock; popup can request signatures but can never request the plaintext.**

### 4.2 Session / idle timeout

Pattern shape across wallets (MetaMask, Bitwarden, password-manager analogues —
[Bitwarden vault timeout](https://bitwarden.com/help/vault-timeout/),
[OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[NIST 800-63B session implementation](https://pages.nist.gov/800-63-3-Implementation-Resources/63B/Session/)):

- Inactivity measured from **last user interaction with the wallet itself**, not
  system idle. Per NIST, idle ≠ user-idle.
- Implemented via `chrome.alarms` (survives SW restart) — set a `lock` alarm
  on every user interaction; fire → zeroize → set `locked: true` in storage.
- `chrome.alarms` minimum period is 30s in Chrome 120+, so 30s-resolution idle
  detection is the floor. Actual timeout surfaces to user as 1/5/15/30/60 min.
- On SW wake, **always check `chrome.storage` for `lockedAt` first** — don't
  rely on in-memory "am I locked" state.

### 4.3 WebAuthn RP ID rotation

Short answer: **no good story exists.** WebAuthn credentials are bound to the
RP ID at creation time. If your extension ID changes (e.g. self-hosted vs Chrome
Web Store), the credential is **unrecoverable**. Mitigations:

- Use `chrome-extension://<id>` as the RP ID and pin the ID by shipping a
  `key` field in the manifest (deterministic extension ID across builds).
- For prod, get on the Chrome Web Store and lock the ID forever.
- Support **fallback to password/mnemonic** for migration.

No wallet has a clean rotation story. [Corbado 2026 WebAuthn PRF article](https://www.corbado.com/blog/passkeys-prf-webauthn)
is the freshest read on credential binding but doesn't solve extension-ID churn.

### 4.4 Tx progress state — state machines vs observable tasks

Three patterns observed:

1. **XState state machines** ([XState](https://xstate.js.org/)) — tx is a machine
   with states `drafting → simulating → awaitingApproval → signing → broadcasting →
   pending → mined | failed`. Actors handle async side effects, the machine
   serialises. Stately's actors model also makes the tx progress itself *subscribable*
   for UIs: `actor.subscribe(observer)` gives you live snapshots.
2. **Redux + thunks/sagas** — MetaMask. Tx lifecycle is reducer-driven;
   `transaction-controller` emits `transactionStateChange` events over the messenger.
3. **Observable task per tx** — a simple `BehaviorSubject<TxState>` per tx,
   kept in a `Map<txId, Observable>` in the SW; popup subscribes over a port.

For Vibeguard: given your existing typed RPC pattern + the long-running nature
of PXE proving, **XState actors per tx** is the strongest fit — they give you
explicit progress states, natural pause/resume across SW restarts (serialize
the state to `chrome.storage`, rehydrate on wake), and a single pattern for
"progress observable" your popup can consume.

---

## 5. Borrowable Patterns (actionable)

One-line tradeoff per item. Ordered roughly by ROI for the Vibeguard refactor.

1. **Adopt `@webext-core/fake-browser` as the test storage adapter.**
   *Tradeoff:* coupling tests to a 3P fake, but gains real storage-behaviour
   assertions instead of mock-call assertions.

2. **Formalise `StoragePort`, `NetworkPort`, `CryptoPort`, `ClockPort`, `UIPort` as interfaces; inject adapters.**
   *Tradeoff:* one refactor pass across all services; permanent unlock of
   parallel test runs without `vi.mock`.

3. **Split into MetaMask-style packages:** `@nulo/core` (domain + ports),
   `@nulo/chrome-adapters`, `@nulo/pxe-adapter`, `@nulo/ui`, `@nulo/extension`.
   *Tradeoff:* more workspace churn up front; cleaner dependency DAG and lets
   `@nulo/core` ship without any browser APIs (pure TS, testable in node).

4. **Typed messenger / event bus between services (à la `@metamask/messenger`).**
   *Tradeoff:* adds a small indirection; removes tight coupling between services
   and lets us swap the transport (postMessage / runtime port / Comlink) under
   one interface.

5. **Consider [Comlink](https://github.com/GoogleChromeLabs/comlink) for popup ↔ SW ↔ offscreen RPC** — or the custom `ServiceClient`/`Service` pair already
   present. Comlink is smaller, type-safe, and works over every messaging
   primitive we use.
   *Tradeoff:* one more runtime dep; loses our bespoke lifecycle hooks unless
   we wrap Comlink with reconnect-on-SW-suspend logic.

6. **Offscreen-document as a "signing island".** Keys live there and there
   only; popup never sees plaintext.
   *Tradeoff:* extra hop on every signature; zero-downside security posture
   and aligns with where PXE already lives.

7. **XState actors for per-tx lifecycle, serialised to `chrome.storage`.**
   *Tradeoff:* XState adds ~30 KB gzipped; buys explicit progress states,
   resumability across SW restarts, and a single "subscribe to tx" shape for
   the popup.

8. **Pre-commit Biome + `tsc --noEmit` (already done) + add Stryker incremental
   mode on PR for `wallet/services/account/**` and `wallet/services/transaction/**`.**
   *Tradeoff:* CI time for those dirs goes up a few minutes; we get actual
   proof the tests catch regressions, not just line coverage.

9. **Migrate the build to WXT (or plain Vite + CRXJS).**
   *Tradeoff:* re-learning the build harness; gains ~40% smaller bundle,
   first-class Vitest integration, and auto-polyfill of `chrome.*` in tests.
   Only take this on if the current webpack/vite setup is itself painful —
   otherwise "not broken, don't fix".

10. **EIP-6963-equivalent provider discovery.** Not a standard in Aztec yet;
    worth raising in the Aztec wallet forum. Until then, ensure Vibeguard
    publishes a discoverable announcement when it injects, so we can
    coexist with Obsidion and Azguard.
    *Tradeoff:* external coordination cost; unblocks multi-wallet installs.

11. **LavaMoat `allow-scripts` at install time (cheap win) + LavaMoat runtime
    for critical paths (expensive win).**
    *Tradeoff:* the runtime layer is non-trivial to integrate with Vite/WXT
    (MetaMask uses Browserify). Allow-scripts alone is a zero-risk adopt.

12. **Reconnect-resilient RPC client.** Every wallet MV3 issue we reviewed
    (MetaMask #16554, #24514) is ultimately "popup connected to a dead SW".
    Wrap `ServiceClient` with a retry + reconnect-on-port-disconnect loop.
    *Tradeoff:* slight complexity in client, massive UX win when Chrome
    kills the SW mid-interaction.

13. **Idle-lock via `chrome.alarms` + `lockedAt` in storage** — don't rely on
    in-memory state. Rehydrate `isLocked` from storage on every SW wake.
    *Tradeoff:* ~1 extra read on wake; correct behaviour across restarts.

14. **Virtual-authenticator passkey tests via CDP** — extend current Puppeteer
    harness with `WebAuthn.addVirtualAuthenticator` calls so passkey flows
    can be exercised end-to-end deterministically.
    *Tradeoff:* tests are Chromium-only (already the case); enables coverage
    of the highest-risk authentication paths.

---

## 6. Key sources in one place

**MV3 lifecycle & offscreen**
- [Chrome SW lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Migrate to a service worker](https://developer.chrome.com/docs/extensions/mv3/migrating_to_service_workers/)
- [MetaMask #16554 — popup+SW restart](https://github.com/MetaMask/metamask-extension/issues/16554)
- [MetaMask #25118 — one-offscreen-doc limit](https://github.com/MetaMask/metamask-extension/issues/25118)

**Provider / RPC**
- [`@metamask/providers`](https://github.com/MetaMask/providers)
- [`@metamask/json-rpc-engine`](https://github.com/MetaMask/json-rpc-engine)
- [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963)
- [MetaMask EIP-6963 vite-react-ts example](https://github.com/MetaMask/vite-react-ts-eip-6963)

**Core packages**
- [`MetaMask/core` monorepo](https://github.com/MetaMask/core)
- [`@metamask/keyring-controller`](https://github.com/MetaMask/core/tree/main/packages/keyring-controller)
- [`@metamask/eth-ledger-bridge-keyring`](https://github.com/MetaMask/eth-ledger-bridge-keyring)

**Snaps / sandboxing**
- [Snaps execution environment](https://docs.metamask.io/snaps/learn/about-snaps/execution-environment/)
- [iframe-execution-environment](https://github.com/MetaMask/iframe-execution-environment)
- [Snaps permissions DeepWiki](https://deepwiki.com/MetaMask/snaps/3.1-permission-system)
- [osec.io Snaps deep-dive](https://osec.io/blog/2023-11-01-metamask-snaps/)

**LavaMoat**
- [LavaMoat repo](https://github.com/LavaMoat/LavaMoat)
- [MetaMask intro](https://metamask.io/news/using-lavamoat-to-solve-software-supply-chain-security)
- [osec.io 2024 bypass + fix](https://osec.io/blog/2024-06-10-supply-chain-attacks-a-new-era/)

**Testing frameworks**
- [WXT](https://wxt.dev/guide/resources/compare), [WXT unit testing](https://wxt.dev/guide/essentials/unit-testing)
- [Plasmo vs WXT vs CRXJS (2025)](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/)
- [Playwright Chrome extensions](https://playwright.dev/docs/chrome-extensions)
- [Puppeteer Chrome extensions](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- [Puppeteer SW termination recipe](https://developer.chrome.com/docs/extensions/how-to/test/test-serviceworker-termination-with-puppeteer)
- [eyeo's MV3 testing migration](https://developer.chrome.com/blog/eyeos-journey-to-testing-mv3-service%20worker-suspension)

**Testing libs**
- [`@webext-core/fake-browser`](https://webext-core.aklinker1.io/fake-browser/installation)
- [`vitest-chrome`](https://github.com/probil/vitest-chrome)
- [`mockzilla-webextension`](https://github.com/lusito/mockzilla-webextension)

**WebAuthn testing**
- [CDP WebAuthn domain](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/)
- [Corbado passkeys Playwright guide](https://www.corbado.com/blog/passkeys-e2e-playwright-testing-webauthn-virtual-authenticator)
- [Chrome DevTools WebAuthn panel](https://developer.chrome.com/docs/devtools/webauthn/)

**DI / architecture**
- [awilix/inversify/tsyringe/typedi comparison](https://npm-compare.com/awilix,inversify,tsyringe,typedi)
- [Stryker Mutator](https://stryker-mutator.io/)
- [Hexagonal Architecture (Wikipedia)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))

**State / cross-context**
- [Zustand + chrome-storage](https://www.drewalth.com/lab/zustand-chrome-storage/)
- [Zustand #2020 — share state SW+popup](https://github.com/pmndrs/zustand/discussions/2020)
- [Taboola — Optimising Chrome Extensions pt.1](https://medium.com/@byeduardoac/optimising-chrome-extensions-part-1-beyond-redux-post-manifest-v3-c4e04d509264)
- [Taboola — pt.2](https://www.taboola.com/engineering/optimising-chrome-extensions-part-2/)
- [Comlink](https://github.com/GoogleChromeLabs/comlink)

**Wallet refs**
- [Rainbow browser-extension](https://github.com/rainbow-me/browser-extension)
- [Rabby](https://github.com/RabbyHub/Rabby)
- [MetaMask extension](https://github.com/MetaMask/metamask-extension)
- [Obsidion wallet (Aztec)](https://app.obsidion.xyz/)
- [ShieldSwap SDK](https://docs.shieldswap.org/)

**XState**
- [XState docs](https://xstate.js.org/), [Stately actors](https://stately.ai/docs/actors)

**Security / sessions**
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [NIST 800-63B Session Implementation](https://pages.nist.gov/800-63-3-Implementation-Resources/63B/Session/)
- [Bitwarden vault timeout](https://bitwarden.com/help/vault-timeout/)
