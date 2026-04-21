# 10 Build And Manifest

## Scope

This note documents how the extension is built and packaged today:

- Vite entry graph
- CRX packaging
- manifest settings and permissions
- environment defines and runtime shims
- browser-specific build differences

## Build entry graph

The extension uses Vite plus `@crxjs/vite-plugin`:

- Chrome build config in [`packages/extension/vite.chrome.config.mts`](../../packages/extension/vite.chrome.config.mts)
- Firefox build config in [`packages/extension/vite.firefox.config.mts`](../../packages/extension/vite.firefox.config.mts)
- shared build config in [`packages/extension/vite.config.ts`](../../packages/extension/vite.config.ts)

The browser-specific wrappers just:

- append the `crx(...)` plugin
- swap in the browser-specific manifest
- set `build.outDir`

in [`vite.chrome.config.mts`](../../packages/extension/vite.chrome.config.mts) and [`vite.firefox.config.mts`](../../packages/extension/vite.firefox.config.mts).

## Runtime entrypoints produced by Vite

The shared Vite config declares three HTML inputs:

- `offscreen: "src/offscreen/index.html"`
- `popup: "src/popup/index.html"`
- `setup: "src/setup/index.html"`

in [`packages/extension/vite.config.ts:175`](../../packages/extension/vite.config.ts#L175) through [`vite.config.ts:181`](../../packages/extension/vite.config.ts#L181).

In addition, the manifest references:

- background service worker `src/wallet/index.ts`
- content script `src/content-script/content.ts`

in [`packages/extension/manifest/manifest.config.ts:18`](../../packages/extension/manifest/manifest.config.ts#L18) through [`manifest.config.ts:31`](../../packages/extension/manifest/manifest.config.ts#L31).

So the real build graph is wider than the `rollupOptions.input` object:

- worker
- popup/sidepanel shell
- content script
- offscreen page
- dormant setup page

## File-system routing and generated route bundles

The popup bundle uses `vite-plugin-pages` to create route sets from:

- `src/pages`
- `src/setup/pages`
- `src/popup/pages`
- `src/popup/windows`

in [`packages/extension/vite.config.ts:88`](../../packages/extension/vite.config.ts#L88) through [`vite.config.ts:107`](../../packages/extension/vite.config.ts#L107).

This is why one `popup/index.html` can serve both normal popup pages and approval windows.

## Manifest shape

The base MV3 manifest is defined in [`packages/extension/manifest/manifest.config.ts`](../../packages/extension/manifest/manifest.config.ts).

### Key fields

- `manifest_version: 3` in [`manifest.config.ts:13`](../../packages/extension/manifest/manifest.config.ts#L13)
- popup default path `src/popup/index.html#/popup/general` in [`manifest.config.ts:15`](../../packages/extension/manifest/manifest.config.ts#L15)
- service worker module `src/wallet/index.ts` in [`manifest.config.ts:18`](../../packages/extension/manifest/manifest.config.ts#L18) through [`manifest.config.ts:21`](../../packages/extension/manifest/manifest.config.ts#L21)
- side panel path `src/popup/index.html` in [`manifest.config.ts:22`](../../packages/extension/manifest/manifest.config.ts#L22) through [`manifest.config.ts:24`](../../packages/extension/manifest/manifest.config.ts#L24)
- content script on all pages and all frames at `document_start` in [`manifest.config.ts:25`](../../packages/extension/manifest/manifest.config.ts#L25) through [`manifest.config.ts:31`](../../packages/extension/manifest/manifest.config.ts#L31)

### Permissions

Declared permissions are:

- `offscreen`
- `storage`
- `sidePanel`
- `unlimitedStorage`

in [`manifest.config.ts:33`](../../packages/extension/manifest/manifest.config.ts#L33).

Optional permissions include only `downloads` in [`manifest.config.ts:34`](../../packages/extension/manifest/manifest.config.ts#L34).

The only host permission is `https://nulo.sh/` in [`manifest.config.ts:14`](../../packages/extension/manifest/manifest.config.ts#L14).

That host permission is significant because passkey creation/get uses RP ID `nulo.sh`, and the popup comments explicitly say the RP ID must match a host in host permissions in [`packages/extension/src/popup/windows/passkey/index.vue:37`](../../packages/extension/src/popup/windows/passkey/index.vue#L37) through [`passkey/index.vue:40`](../../packages/extension/src/popup/windows/passkey/index.vue#L40).

### CSP and cross-origin isolation

The manifest sets:

- `content_security_policy.extension_pages = "script-src 'self' 'wasm-unsafe-eval'"` in [`manifest.config.ts:35`](../../packages/extension/manifest/manifest.config.ts#L35) through [`manifest.config.ts:37`](../../packages/extension/manifest/manifest.config.ts#L37)
- `cross_origin_embedder_policy = require-corp` in [`manifest.config.ts:38`](../../packages/extension/manifest/manifest.config.ts#L38) through [`manifest.config.ts:40`](../../packages/extension/manifest/manifest.config.ts#L40)
- `cross_origin_opener_policy = same-origin` in [`manifest.config.ts:41`](../../packages/extension/manifest/manifest.config.ts#L41) through [`manifest.config.ts:43`](../../packages/extension/manifest/manifest.config.ts#L43)

This matches the dev server headers in [`packages/extension/vite.config.ts:33`](../../packages/extension/vite.config.ts#L33) through [`vite.config.ts:37`](../../packages/extension/vite.config.ts#L37).

The repo is clearly tuned for multithreaded Barretenberg/WASM execution.

## Browser-specific manifest differences

### Chrome

Chrome simply uses the base manifest via `defineManifest(...)` in [`packages/extension/manifest/manifest.chrome.config.ts:5`](../../packages/extension/manifest/manifest.chrome.config.ts#L5) through [`manifest.chrome.config.ts:8`](../../packages/extension/manifest/manifest.chrome.config.ts#L8).

### Firefox

Firefox modifies the base manifest to:

- add `browser_specific_settings.gecko.id`
- convert background config from MV3 `service_worker` to `scripts`
- set `persistent: false`

in [`packages/extension/manifest/manifest.firefox.config.ts:5`](../../packages/extension/manifest/manifest.firefox.config.ts#L5) through [`manifest.firefox.config.ts:18`](../../packages/extension/manifest/manifest.firefox.config.ts#L18).

There is also a permissions filter removing `"background"` in [`manifest.firefox.config.ts:17`](../../packages/extension/manifest/manifest.firefox.config.ts#L17) through [`manifest.firefox.config.ts:18`](../../packages/extension/manifest/manifest.firefox.config.ts#L18), but the base manifest permissions do not appear to include `"background"`. That looks like stale compatibility code.

## Vite shims and compatibility hacks

The shared Vite config contains several non-trivial browser/runtime adaptations.

### Package aliasing

Aliases map:

- `@`, `~`, `src`, `@assets`
- selected Aztec/noir artifact JSON files
- `@alejoamiras/aztec-accelerator` to its built `dist/index.js`
- `detect-node` to a local shim

in [`vite.config.ts:39`](../../packages/extension/vite.config.ts#L39) through [`vite.config.ts:58`](../../packages/extension/vite.config.ts#L58).

The `detect-node` shim exists specifically to stop `@aztec/foundation` logging from taking a Node path because node polyfills make the environment look server-like in [`vite.config.ts:51`](../../packages/extension/vite.config.ts#L51) through [`vite.config.ts:55`](../../packages/extension/vite.config.ts#L55).

### Noir ABI dedupe

Vite forces single-copy resolution for `@aztec/noir-noirc_abi` and `@aztec/noir-acvm_js` in [`vite.config.ts:59`](../../packages/extension/vite.config.ts#L59) through [`vite.config.ts:64`](../../packages/extension/vite.config.ts#L64) to avoid multiple WASM module scopes.

This is not cosmetic. It is a build-time workaround for a runtime correctness issue.

### bb.js fetch-code shim

The build replaces bb.js’ `fetch_code` module with a local shim in [`vite.config.ts:73`](../../packages/extension/vite.config.ts#L73) through [`vite.config.ts:85`](../../packages/extension/vite.config.ts#L85).

The reason is explicit in the comment:

- MV3 service workers forbid runtime `import()`
- the shim uses `fetch()` against WASM files under `/assets/` instead

This is a targeted workaround for MV3’s worker restrictions.

### Auto-imports and component auto-registration

The UI build uses:

- `unplugin-auto-import` for `vue`, `vue-router`, `webextension-polyfill`, plus project composables/stores/utils in [`vite.config.ts:109`](../../packages/extension/vite.config.ts#L109) through [`vite.config.ts:128`](../../packages/extension/vite.config.ts#L128)
- `unplugin-vue-components` over `src/components` in [`vite.config.ts:130`](../../packages/extension/vite.config.ts#L130) through [`vite.config.ts:133`](../../packages/extension/vite.config.ts#L133)

This explains why many SFCs use helpers without explicit imports.

### Asset rewriting and WASM serving

The build also:

- rewrites `/assets/` paths in built HTML in [`vite.config.ts:135`](../../packages/extension/vite.config.ts#L135) through [`vite.config.ts:143`](../../packages/extension/vite.config.ts#L143)
- forces `application/wasm` for dev server `.wasm` responses in [`vite.config.ts:145`](../../packages/extension/vite.config.ts#L145) through [`vite.config.ts:155`](../../packages/extension/vite.config.ts#L155)
- copies gzipped bb.js WASM files into `assets/` in [`vite.config.ts:157`](../../packages/extension/vite.config.ts#L157) through [`vite.config.ts:164`](../../packages/extension/vite.config.ts#L164)

### Node polyfills

`vite-plugin-node-polyfills` includes:

- `buffer`
- `net`
- `path`
- `stream`
- `tty`
- `vm`
- `util`

in [`vite.config.ts:166`](../../packages/extension/vite.config.ts#L166) through [`vite.config.ts:168`](../../packages/extension/vite.config.ts#L168).

This is another sign the app is carrying packages not originally designed for extension-browser runtimes.

## Build/runtime defines

Compile-time defines include:

- `__VERSION__`
- `__SENTINEL__`
- `__AZTEC_VERSION__`
- `__NAME__`
- `__DISPLAY_NAME__`
- `import.meta.env.HTML_TITLE`

in [`vite.config.ts:190`](../../packages/extension/vite.config.ts#L190) through [`vite.config.ts:201`](../../packages/extension/vite.config.ts#L201).

The build also injects:

- `process.browser = true`
- `process.env.LOG_LEVEL = "verbose"`
- `process.env.BB_WASM_PATH = "/assets/barretenberg.wasm.gz"`

in the same block.

These defines are read by both the worker and popup. For example, the worker initializes Barretenberg from `process.env.BB_WASM_PATH` in [`packages/extension/src/wallet/index.ts:69`](../../packages/extension/src/wallet/index.ts#L69) through [`wallet/index.ts:71`](../../packages/extension/src/wallet/index.ts#L71).

## Package metadata and scripts

The extension package declares:

- Vite dev/build scripts
- `vitest` unit tests
- separate e2e Vitest configs

in [`packages/extension/package.json`](../../packages/extension/package.json).

Notable build metadata:

- `version: "0.11.0"`
- `sentinel: "7"`

The sentinel is surfaced into UI/local storage via `__SENTINEL__` and `setSentinel()` in [`packages/extension/src/utils/core.js:61`](../../packages/extension/src/utils/core.js#L61) through [`utils/core.js:68`](../../packages/extension/src/utils/core.js#L68).

## Architectural read

### What is good

- The build clearly acknowledges MV3 constraints instead of pretending stock Vite/browser settings are enough.
- The Aztec/WASM hacks are commented with real failure modes, which makes maintenance easier.
- Entry points are explicit and small in number.
- Browser-specific manifests are isolated cleanly.

### Current pressure points

1. The build relies on several fragile compatibility patches.
`bb-fetch-code` replacement, `detect-node` shim, noir package dedupe, asset rewrites, and node polyfills are all necessary today, but each is a moving integration surface.

2. Browser compatibility is encoded as scattered assumptions.
RP ID, COEP/COOP, WASM pathing, host permissions, and manifest/browser differences are spread across multiple files.

3. The extension ships dormant build surfaces.
`src/setup/index.html` is still built even though setup launch is commented out in the worker.

4. The content script is extremely broad.
It matches `*://*/*` and `all_frames: true` in [`manifest.config.ts:25`](../../packages/extension/manifest/manifest.config.ts#L25) through [`manifest.config.ts:31`](../../packages/extension/manifest/manifest.config.ts#L31). That is operationally convenient but broad in attack surface and performance footprint.

5. The package graph is browser-hostile enough to require substantial polyfilling.
That is architectural debt, not just build debt.

## Recommendations flowing from this concern

1. Consolidate compatibility invariants into a documented build contract.
Risk: low. Size: hours.
Create one maintainer document or config module covering RP ID, COEP/COOP, WASM paths, host permissions, and required shims.

2. Shrink the runtime package surface that needs polyfills.
Risk: medium. Size: days to weeks.
Every removed Node-oriented dependency simplifies MV3 behavior and reduces browser/runtime ambiguity.

3. Isolate Aztec/browser shims behind a dedicated compatibility package.
Risk: medium. Size: days.
Put `bb-fetch-code`, `detect-node`, WASM path handling, and related build helpers under one owned module instead of leaving them embedded in Vite config.

4. Remove or reactivate the setup app intentionally.
Risk: low. Size: hours.
Today it is dead weight or unfinished product surface, depending on intent.

5. Re-evaluate content-script match scope and frame scope.
Risk: medium. Size: days.
If wallet-sdk truly needs global discovery on all frames, document it. If not, narrow it.
