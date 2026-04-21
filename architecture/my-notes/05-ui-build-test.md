# Nulo Wallet Chrome Extension: UI Architecture, Build System & Test Surface

**Package:** `/Users/alejoamiras/Projects/jp4g-azguard/vibeguard/packages/extension/`
**Date:** April 20, 2026
**Version:** 0.11.0 (Sentinel: 7)

---

## 1. Vue 3 Popup Architecture

### 1.1 File-Based Routing (vite-plugin-pages)

**vite.config.ts:88-107** — Routing directories configured:

```typescript
usePages({
  dirs: [
    { dir: "src/pages", baseRoute: "common" },          // Global pages
    { dir: "src/setup/pages", baseRoute: "setup" },     // Setup flow
    { dir: "src/popup/pages", baseRoute: "popup" },     // Popup pages
    { dir: "src/popup/windows", baseRoute: "windows" }, // Modal windows
  ],
})
```

**Pages Inventory** (`src/popup/pages/`):

1. **`index.vue`** → `/popup/` (redirects to `/popup/general`)
2. **`auth.vue`** → `/popup/auth` 
   - `meta.isAuthRequired: false`
   - Password/passkey entry screen for existing profiles
3. **`general.vue`** → `/popup/general`
   - `meta.isAuthRequired: true, showBottomNav: true`
   - Main dashboard: balance, tokens, recent activity
4. **`activity.vue`** → `/popup/activity`
   - `meta.isAuthRequired: true, showBottomNav: true`
   - Transaction history view
5. **`register.vue`** → `/popup/register`
   - `meta.isAuthRequired: false`
   - New wallet creation (password, passkey, seed)
6. **`send.vue`** → `/popup/send` — Transaction sending
7. **`tx/[id].vue`** → `/popup/tx/:id` — Transaction detail view
8. **`tokens/[id].vue`** → `/popup/tokens/:id` — Token detail page
9. **`settings/index.vue`** → `/popup/settings`
   - `meta.isAuthRequired: true, showBottomNav: true`
   - Settings hub with subsections:
     - `settings/general` — Theme, display options
     - `settings/appearance.vue` — UI theming
     - `settings/security/index.vue` + `/export/{key|seed|full}.vue` — Key export
     - `settings/privacy/index.vue` — Privacy controls
     - `settings/profile/index.vue` — Profile management
     - `settings/accounts/index.vue` — Account list
     - `settings/contacts/index.vue` — Contact book
     - `settings/networks/index.vue` — Network management
     - `settings/tokens/index.vue` — Token registry
     - `settings/fpcs/index.vue` — FPC settings
     - `settings/connected-apps/index.vue` + `/[id].vue` — dApp sessions
     - `settings/advanced/index.vue` — Advanced options
       - `/account-state/{contracts|authwits|senders|notes}/index.vue` — Contract/auth state viewers
     - `settings/about.vue` — Version info
10. **`[...catch].vue`** → Fallback 404 page

### 1.2 Auth Gating with route.meta.isAuthRequired

**src/popup/app.vue:56-73** — Navigation guard enforces auth:

```typescript
router.beforeEach((to, from, next) => {
  if (to.meta.isAuthRequired && !appStore.isLogined) {
    appStore.pageAwaitingAuth = to.path
    next(appStore.profiles.length ? "/popup/auth" : "/popup/register")
  } else {
    next()
  }
})
```

**Pattern:** 
- `isAuthRequired: false` pages (auth, register) show before login
- `isAuthRequired: true` pages require `appStore.isLogined = true`
- Bottom nav (3-tab) visible only on pages with `showBottomNav: true` (general, activity, settings)

**Navigation.vue:4-23** — Bottom navigation (sticky, 3 tabs):

```vue
const navigationLinks = [
  { name: "general", path: "/popup/general", materialIcon: "account_balance_wallet", label: "ASSETS" },
  { name: "activity", path: "/popup/activity", materialIcon: "history", label: "HISTORY" },
  { name: "settings", path: "/popup/settings", materialIcon: "settings", label: "SETTINGS" },
]
```

### 1.3 Pinia Stores

#### useAppStore (`src/stores/app.store.ts:42-199`)

**Responsibilities:**
- Profile & account lifecycle: `profile`, `profiles`, `isRegistered`, `isLogined`, `isSessionChecked`
- Network state: `network`, `networks`, `networkStatus`, `syncNetworkStatus()`
- Account selection: `account`, `accounts`, `setupActiveAccount()`, `selectAccount()`, `changeAccountVisibility()`, `updateAccount()`
- Transaction cache: `transactions`, `awaitingTransactions`, `onTxAdded()`, `onTxUpdated()`, `syncTransactions()`
- Settings: `displayOption`, `isPrivacyModeEnabled`, `defaultExplorer`
- dApp sessions: `dappSessions`
- UI state: `isLoading`, `showRegisterPopup`, `pageAwaitingAuth`, `loggerWindowId`

**Data Flow:**
- `managers.profile.onActiveProfileChanged.add()` (app.vue:157) triggers `onActiveProfileChanged()` callback
- On login: networks initialized → accounts fetched → transaction service initialized
- On network switch: accounts reloaded for new chain
- Chrome storage keys: `nulo:ui:activeAccount`, `nulo:ui:activeNetwork`, `nulo:ui:lastActiveNetwork@{profileId}`

#### usePopupStore (`src/stores/popup.store.ts:10-34`)

**Responsibilities:**
- Global popup/modal management: `popups` (key → {order, payload})
- Helpers: `isOpened()`, `open()`, `close()`, `closeAll()`, `getPayload()`
- Used by PopupManager.vue to render stack of overlays in z-order

#### useCacheStore (`src/stores/cache.store.ts:11-69`)

**Responsibilities:**
- Transient UI form state:
  - Edit indices: `networkToEditIdx`, `accountToEditIdx`, `contactToEditIdx`, `tokenToEditIdx`, `fpcToEditIdx`
  - Preselections: `preselectedBalanceType`, `preselectedContactToSend`, `preselectedTokenAddressToAdd`, `preselectedAuthwits`
  - Active token: `activeTokenIdx`
- Import workflow: `importType`, `importContact`, `importContacts`, `importPromise`
- Networks: `proposedNetworks`, `selectedNetwork`
- Fee methods: `feePaymentMethods`
- Claim parameters: `claimParameters`
- Misc: `failureLog`, `viewerData`, `privacySettings` (from stealth promo)

#### useNotificationStore (`src/stores/notification.store.ts:22-53`)

**Responsibilities:**
- Queue-based notifications: `active` (current), `queue` (pending)
- Methods: `create()` (push to queue), `removeActive()` (pop and show next), `showNext()`
- Auto-destroy with delay configurable per notification
- Used for warnings, errors, confirmations

### 1.4 Composables (src/composables/)

**Auto-imported:** vite.config.ts:118 → `dirs: ["src/composables/", "src/stores/", "src/utils/"]`

**Key composables:**

1. **`syncedRef.js`** (src/composables/syncedRef.js:1-24)
   - Singleton pattern: auto-syncs Vue ref with chrome.storage.local
   - Used by: `appStore.loggerWindowId` (persistent logger window ID)
   - Watchers sync on both mutation and chrome.storage.onChanged

2. **`notification.js`** (src/composables/notification.js:1-66)
   - Stateful: uses app/popup/notification stores + toast composable
   - `getTemplate()` — notification templates (aztecReset)
   - `checkNotificationsForShow()` — async sentinel check + trigger

3. **`configClient.ts`** (src/composables/configClient.ts)
   - ConfigServiceClient wrapper for settings updates
   - Singleton: listens to `configService.onUpdate` events

4. **`toast.js`** (src/composables/toast.js)
   - Toast notifications (non-blocking)

5. **`externalImage.js`** / **`externalLinks.js`**
   - Privacy controls for external content loading

### 1.5 Global Components & Auto-import

**vite.config.ts:130-133**:
```typescript
useComponents({
  dirs: ["src/components"],
  dts: "src/types/components.d.ts",
})
```

**Core Components** (`src/components/core/`):
- `Flex.vue` — Layout wrapper (direction, gap, align, justify)
- `Text.vue` — Typography
- `Icon.vue` — SVG icons
- `MaterialIcon.vue` — Material Design icons

**UI Components** (`src/components/ui/`, 31 files):
- `Dropdown/` — Dropdown menu
- `JsonViewer/` — JSON syntax-highlighted viewer
- `Popup/` — Modal overlay
- `Settings/` — Settings-specific controls
- Plus: buttons, badges, loaders, etc.

**Auto-import via unplugin-vue-components:**
- No explicit imports needed: `<Flex>`, `<MaterialIcon>` work automatically
- Generated types: `src/types/components.d.ts`

---

## 2. Build System

### 2.1 Vite Plugins & Configurations

**vite.config.ts (primary config, ~200 lines)**

**Plugins in order:**

1. **bb-fetch-code-shim (lines 77-85, custom)**
   - Intercepts `@aztec/bb.js` WASM module loading
   - Replaces dynamic `import()` with `fetch()` (MV3 service workers forbid runtime import)
   - Redirects to `src/shims/bb-fetch-code.ts`

2. **vue() (line 86)**
   - @vitejs/plugin-vue v6.0.1
   - Processes .vue Single-File Components

3. **usePages (vite-plugin-pages v0.33.1, lines 88-107)**
   - Generates routes from directory structure
   - Routes in `src/popup/pages/`, `src/popup/windows/`, etc.
   - Auto-generates router (no manual route definition)

4. **useAutoImport (unplugin-auto-import v20.0.0, lines 109-128)**
   - Auto-imports Vue 3 APIs: `ref`, `computed`, `watch`, `onMounted`, `useRouter`, `useRoute`
   - Auto-imports composables from `src/composables/`, `src/stores/`, `src/utils/`
   - Browser polyfill: `import * as browser from "webextension-polyfill"`
   - Generates `src/types/auto-imports.d.ts` + `.eslintrc-auto-import.json`
   - Rewrites template `{{ functionName(...) }}` without explicit imports via `vueTemplate: true`

5. **useComponents (unplugin-vue-components v29.0.0, lines 130-133)**
   - Auto-discovers & registers `src/components/**/*.vue` components
   - No explicit imports or registrations needed
   - Generates `src/types/components.d.ts`

6. **assets-rewrite (custom, lines 135-143)**
   - Rewrites `/assets/` paths in HTML during build for subdirectory deployment

7. **wasm-content-type (custom, lines 145-155)**
   - Dev server middleware: sets `Content-Type: application/wasm` for `.wasm` files

8. **viteStaticCopy (vite-plugin-static-copy v3.1.1, lines 157-164)**
   - Copies `libs/@aztec/bb.js/*.wasm.gz` → `assets/` during build
   - WASM bundles (~1-2MB) for Barretenberg proving

9. **nodePolyfills (vite-plugin-node-polyfills v0.24.0, lines 166-168)**
   - Polyfills Node.js modules: `buffer`, `net`, `path`, `stream`, `tty`, `vm`, `util`
   - Excludes `crypto` (uses native crypto API instead)

**Browser-specific configs:**

- **vite.chrome.config.mts** (lines 1-22)
  - Adds `crx()` plugin from @crxjs/vite-plugin v2.1.0
  - Outputs: `dist/chrome`
  - Manifest: `manifest/manifest.chrome.config.ts`

- **vite.firefox.config.mts** (lines 1-23)
  - Same structure, outputs: `dist/firefox`
  - Manifest: `manifest/manifest.firefox.config.ts`

### 2.2 Manifest & MV3 Configuration

**manifest/manifest.config.ts (base, ~57 lines)**

```typescript
manifest_version: 3
version: "${major}.${minor}.${patch}.${label}" (from package.json)
action.default_popup: "src/popup/index.html#/popup/general"
background.service_worker: "src/wallet/index.ts" (type: "module")
side_panel.default_path: "src/popup/index.html"
content_scripts: [{ matches: "*://*/*", run_at: "document_start", js: "src/content-script/content.ts" }]
host_permissions: ["https://nulo.sh/"]
permissions: ["offscreen", "storage", "sidePanel", "unlimitedStorage"]
optional_permissions: ["downloads"]
CSP: "script-src 'self' 'wasm-unsafe-eval'" (allows inline WASM)
COEP: "require-corp" (Cross-Origin-Embedder-Policy for multithreaded WASM)
COOP: "same-origin" (Cross-Origin-Opener-Policy)
```

**manifest.firefox.config.ts:**
- Inherits base, adds `browser_specific_settings.gecko.id`
- Background: `scripts` (not service_worker), `persistent: false`
- Filters out "background" permission (Firefox incompatibility)

**manifest.chrome.config.ts:**
- Inherits base as-is
- Uses service_worker (MV3-compliant)

### 2.3 TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,              // ← Strict mode enabled
    "noEmit": true,              // ← Type-check only, no emit
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "paths": {
    "@/*": ["./src/*"],
    "~/*": ["./src/*"],
    "src/*": ["./src/*"],
    "@assets/*": ["./src/assets/*"]
  }
}
```

**Strictness posture:** `strict: true` enabled, but see type-check gaps below.

### 2.4 Build Output Structure

**dist/chrome/** (post-build):
```
├── manifest.json (generated by crx plugin)
├── service-worker-loader.js (entry point for background service worker)
├── src/
│   ├── popup/index.html
│   ├── setup/index.html
│   ├── offscreen/index.html
│   ├── assets/logo.png
├── assets/ (223 files)
│   ├── *.wasm.gz (Barretenberg, ~1-2MB)
│   ├── *.js (chunk bundles, tree-shaken)
│   └── *.css (scoped styles)
└── logo.svg
```

**Chunks strategy:** Vite default + manual `input` config (popup, setup, offscreen as entry points)

### 2.5 Environment & Feature Flags

**vite.config.ts:190-202 define block:**

```typescript
__VERSION__: "0.11.0"
__SENTINEL__: "7" (schema version)
__AZTEC_VERSION__: "4.2.0-nightly.20260413"
__NAME__: "@nulo/extension"
__DISPLAY_NAME__: "Nulo"
__HTML_TITLE__: "Nulo"
process.browser: true
process.env.LOG_LEVEL: "verbose"
process.env.BB_WASM_PATH: "/assets/barretenberg.wasm.gz"
```

**No .env file pattern:** Feature flags hard-coded or controlled via stores (e.g., `isPrivacyModeEnabled`).

---

## 3. Test Surface

### 3.1 Unit Tests

**Location:** `src/**/*.test.ts` (9 test files)

**Test files:**

1. **src/wallet/services/execution/utils/fee-detection.test.ts** (9 tests)
   - Fee estimation logic

2. **src/wallet/services/wallet-sdk/scope-enforcement.test.ts** (42 tests)
   - Permission/capability scope validation

3. **src/wallet/utils/rw-guard.test.ts** (6 tests)
   - Read-write guard synchronization

4. **src/wallet/logger/store.test.ts** (16 tests)
   - Logger state management

5. **src/wallet/utils/mnemonic.test.ts** (4 tests)
   - Seed phrase validation

6. **src/wallet/services/task/client.test.ts** (5 tests)
   - Task service client communication

7. **src/wallet/services/task/service.test.ts** (21 tests)
   - Task lifecycle (create, update, delete, subtasks)

8. **src/wallet/services/account/contracts/nulo-account.test.ts** (1 test)
   - Account contract initialization

9. **src/wallet/services/profile/encryption/encryption-key.test.ts** (4 tests)
   - Encryption key derivation (PBKDF2)

**Results (bun run test):**
```
Test Files:  9 passed (9)
Tests:       108 passed (108)
Duration:    1.63s
```

**Coverage gaps:**
- NO tests for Vue components (popup pages, composables)
- NO tests for stores (app.store, popup.store, cache.store)
- NO tests for services communication (client/service pairs untested)
- NO tests for routing logic or auth guards
- Backend services (execution, transaction, dapp-interaction) largely untested

### 3.2 E2E Tests

**Location:** `tests/e2e/**/*.test.ts` (13 test files, Puppeteer-based)

**Test files:**

1. **navigation.test.ts** (4 tests)
   - Settings page sections visible
   - Activity page empty state
   - Bottom nav tab switching
   - About page version info

2. **registration.test.ts** (2 tests, [status: failing])
   - Fresh install → register page
   - Create profile with password

3. **contacts.test.ts** (4 tests, [status: failing])
   - Contacts page empty state
   - Add contact via popup
   - Edit contact name
   - Delete contact

4. **accounts.test.ts** (4 tests, 3 failing, 1 skipped)
   - Initial account shown
   - Create second account
   - Switch between accounts
   - (skipped) Hide and restore account

5. **wallet-lock.test.ts** (2 tests, [status: failing])
   - Lock wallet and unlock with password
   - Stealth mode toggle

6. **connect-dapp.test.ts** (1 test, [status: skipped])
   - dApp connection flow

7. **network/transfers.test.ts** — Transfer execution
8. **network/fee-methods.test.ts** — Fee payment method selection
9. **network/token-management.test.ts** — Token registry operations
10. **network/networks.test.ts** — Network configuration
11. **network/multi-account.test.ts** — Multi-account operations
12. **network/tokens.test.ts** — Token balance tracking

13. **slow/mint-token.test.ts** — Token minting (long-running)

**Test Framework:**
- vitest (v3.2.4) + Puppeteer (v24.37.5)
- Config: `vitest.e2e.config.ts` (standalone suite)
- Fixtures: `tests/e2e/fixtures/{extension,aztec,helpers}.ts`

**Global setup:** `global-setup.ts`, `global-setup-smoke.ts`

**Results (bun run test:e2e, Apr 20 19:05-19:07):**
```
Status: 15 failed, 0 passed, 4 skipped
Failures: All basic navigation/registration tests timeout (10-30s)
Reason: Extension initialization hanging (Puppeteer not waiting for background service worker ready)
```

**Test status analysis:**

| Category | Count | Status |
|----------|-------|--------|
| Unit (src/**/*.test.ts) | 9 | ✅ All pass |
| Unit tests | 108 | ✅ All pass |
| E2E basic (navigation, accounts, contacts) | 15 | ❌ All timeout |
| E2E network/slow | 8 | ❌ Blocked by setup |
| Total E2E | 22 | ❌ 15 fail, 4 skip |

### 3.3 Test Fixtures & Helpers

**tests/e2e/fixtures/extension.ts** (Puppeteer extension fixture)
- `openPopup()` — Launch extension popup page
- `registerProfile()` — Create wallet with password
- `waitForHash()` — Wait for route hash change
- `typeIntoInput()` — Type text into input
- `clickNavTab()` — Click bottom navigation tab
- `clickButtonByText()` — Click button by text label

**tests/e2e/fixtures/helpers.ts**
- `clickNavTab()`, etc.

**tests/e2e/fixtures/aztec.ts**
- Aztec test utilities (RPC, contract deployment)

### 3.4 Biggest Test Gaps

**High-priority untested areas:**

1. **Vue components** (31 UI + 15 popup/modal components)
   - No component unit tests
   - No snapshot tests
   - No interaction tests (click, input, validation)
   - PopupManager modal stacking untested
   - Navigation.vue routing logic untested

2. **Store coordination**
   - App → popup → cache store interactions not tested
   - Auth state transitions (login → network init → transaction sync) untested
   - Cache store state resets untested

3. **Routing & auth**
   - Route guards (isAuthRequired) untested
   - Page transitions with auth state changes untested
   - Browser back/forward navigation untested

4. **Service integration**
   - Network service (connection, status sync) untested
   - Account service (creation, visibility, selection) untested
   - Transaction service (sync, listener) untested
   - Profile service (activation, creation) untested

5. **Popup/modal system**
   - Popup manager z-order untested
   - Modal lifecycle (open → payload → close) untested
   - Popup stacking and dismissal untested

6. **E2E infrast**
   - Extension startup timeout issues
   - Service worker lifecycle not properly waited
   - Fixture initialization hanging

---

## 4. TypeScript Posture

### 4.1 Strictness

**tsconfig.json:** `strict: true` enabled

**Actual errors (bun run typecheck):**
- 145+ errors reported across Vue components and services
- Pre-existing debt (not recent regressions)

### 4.2 Error Breakdown

**Category breakdown:**

1. **Vue component type issues** (~50 errors)
   - `CapabilityDetailPanel.vue:121+` — Property 'scope' missing on `{}` type
   - `RegisterPopup.vue:3` — No declaration file for `WalletPasswordContent.vue` (implicit any)
   - Unused `@ts-expect-error` directives in windows/* components
   - Array filter/find type narrowing failures

2. **.js imports implicitly any** (~15 errors)
   - `@/utils/core.js` — No type declaration
   - `@/utils/amount.js` — No type declaration
   - `@/composables/syncedRef.js` — No type declaration (should be .ts)
   - `@/popup/components/modules/**/*.vue` — Missing `.d.ts` files

3. **Router auto-import** (~2 errors)
   - `vue-router-auto.d.ts` not recognized as module

4. **Service type mismatches** (~40 errors)
   - Aztec SDK Fr/AztecAddress type incompatibilities
   - FunctionAbi vs FunctionArtifact mismatch
   - GasFees bigint vs string/number conversion issues
   - IntentInnerHash type conversions
   - readonly property assignments in execution service

5. **Parameter type annotations** (~20 errors)
   - Parameter `id`, `name`, `url`, `target`, `tx`, `tx` missing type annotations
   - Implicit `any` on multiple store methods
   - LocationQueryValue[] vs string mismatches in passkey window

6. **Test file issues** (~2 errors)
   - `afterEach` not found in logger store test

### 4.3 .js vs .ts Distribution

**JS files in src/ (should be TS):**

```
src/composables/
  - notification.js (stateful, uses stores)
  - outside.js
  - syncedRef.js (chrome.storage syncing)
  - toast.js

src/utils/
  - core.js (managers, browser connection)
  - amount.js (number formatting)
  - general.js (utilities)

src/components/ui/
  - Dropdown/index.js
  - JsonViewer/{theme,creator}.js
```

**Impact:** These .js files prevent TypeScript compiler from type-checking them, causing implicit `any` errors downstream.

### 4.4 Pre-existing vs Recent

**Pre-existing debt identified:**

- Vue component any-types (long-standing)
- .js file lack of types (design choice, unclear if intentional)
- Service type mismatches (Aztec SDK version mismatch?)
- Test file scaffold incompleteness

**Recently introduced:** None detected in this snapshot; errors are systemic.

---

## 5. Lint / Format Posture

### 5.1 Biome Configuration

**biome.json** (root level, applied to entire workspace):

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 4,
    "lineWidth": 140,
    "lineEnding": "lf",
    "bracketSpacing": true
  },
  "linter": {
    "recommended": true,
    "style": {
      "noNonNullAssertion": "off",
      "noParameterAssign": "off",
      "useEnumInitializers": "off"
    },
    "performance": {
      "noDelete": "info",
      "noAccumulatingSpread": "warn"
    },
    "suspicious": {
      "noExplicitAny": "error",  // ← ANY type errors
      "noImplicitAnyLet": "warn",
      "noAsyncPromiseExecutor": "off",
      "noAssignInExpressions": "warn",
      "useIterableCallbackReturn": "warn"
    },
    "complexity": {
      "noExtraBooleanCast": "off",
      "noForEach": "off",
      "noBannedTypes": "warn"  // ← {} warnings
    }
  },
  "overrides": [
    {
      "includes": ["**/*.vue"],
      "linter": {
        "rules": {
          "correctness": {
            "noUnusedVariables": "off",
            "noUnusedImports": "off"  // ← Vue unused vars suppressed
          }
        }
      }
    }
  ]
}
```

### 5.2 Lint Results

**bun run lint (Apr 20 22:06):**

```
Status: 18 warnings, 0 errors, 324 files checked, 101ms
```

**Warning breakdown:**

1. **Unused variables** (2)
   - `WalletMetadata` type in app.store.ts:10
   - `AccountTokenMap` class in app.store.ts:14

2. **Implicit any** (3)
   - `utils/files.ts:46` — `let blob` uninitialized
   - `wallet/utils/fetch.ts:55` — `let responseJson` uninitialized
   - `wallet/services/execution/service.ts:2075` — `let fn` uninitialized

3. **forEach callback return** (7)
   - `base/background/client.ts:59` — forEach with reject() call
   - `base/offscreen/client.ts:41` — forEach with clearTimeout()
   - `base/offscreen/client.ts:44` — forEach with reject()
   - `dapp-interaction/service.ts:325` — forEach with checkMethodPermission()
   - `task/service.ts:232` — forEach with deleteTaskTree()
   - `token-balance/service.ts:417` — forEach with pendingTasks.delete()
   - `transaction/service.ts:42` — Unused private member `pxeService`

4. **Banned types** ({} type, 6 warnings)
   - `base/background/client.ts:10` — EventsMap = {}
   - `base/background/service.ts:9` — EventsMap = {}
   - `base/index.ts:16` — EventsMap = {}
   - `base/offscreen/client.ts:12` — EventsMap = {}
   - `base/offscreen/service.ts:14` — EventsMap = {}

**No errors:** All warnings are low-severity style violations, not blockers.

---

## 6. Auto-Import & Component Registry

### 6.1 Auto-Import Directories

**vite.config.ts:109-128:**

```typescript
useAutoImport({
  imports: [
    "vue",                          // ref, computed, watch, useRouter, etc.
    "vue-router",                   // useRouter, useRoute
    { "webextension-polyfill": [["*", "browser"]] }, // browser global
  ],
  dirs: [
    "src/composables/",  // useToast, useSyncedRef, etc.
    "src/stores/",       // useAppStore, usePopupStore, etc.
    "src/utils/",        // managers, trimAddress, etc.
  ],
  vueTemplate: true,     // {{ trimAddress(...) }} in templates
  dts: "src/types/auto-imports.d.ts",
  eslintrc: { enabled: true, filepath: "src/types/.eslintrc-auto-import.json" }
})
```

**Effect:** No explicit imports needed for composables, stores, utils, or Vue APIs in SFC templates/scripts.

### 6.2 Component Registry

**vite.config.ts:130-133:**

```typescript
useComponents({
  dirs: ["src/components"],
  dts: "src/types/components.d.ts",
})
```

**Auto-registered components:**
- `<Flex>` — src/components/core/Flex.vue
- `<Text>` — src/components/core/Text.vue
- `<MaterialIcon>` — src/components/core/MaterialIcon.vue
- `<Icon>` — src/components/core/Icon.vue
- All UI components: buttons, inputs, dropdowns, etc.
- All popup components: modals, overlays

---

## 7. Service Worker & Background Script

**Manifest:** `background.service_worker: "src/wallet/index.ts"` (MV3)

**Architecture:**
- Single MV3 service worker (src/wallet/index.ts)
- Offscreen document (src/offscreen/index.ts) for sensitive operations
- Content script (src/content-script/content.ts) for dApp injection

**Service client/server pattern:**
- Each service has Service (background) and ServiceClient (popup/content)
- Communication via chrome.runtime.onMessage / chrome.runtime.sendMessage

---

## 8. Summary & Recommendations

### Architecture Strengths

1. **Clean file-based routing** — vite-plugin-pages removes manual route definitions
2. **Comprehensive store system** — Clear separation: app (profile/network), popup (modal), cache (forms), notification (toasts)
3. **Type-first design** — `strict: true` in tsconfig (though gaps exist)
4. **Modern tooling** — Vite, Vitest, Biome, Vue 3.5 with Composition API
5. **Solid unit test foundation** — 108 passing tests cover core services

### Architecture Gaps

1. **Component testing desert** — 0 Vue component tests for 46 UI components
2. **E2E brittleness** — Puppeteer fixture timeouts on startup (service worker lifecycle issues)
3. **TypeScript debt** — 145+ errors from implicit any in .js files and Vue component anys
4. **Store isolation** — No tests for inter-store communication (app ↔ popup ↔ cache)
5. **Auth flow untested** — No tests for login/logout/session state transitions

### Recommendations

**Immediate priority:**

1. **Fix .js → .ts migration** — Convert `src/composables/*.js`, `src/utils/core.js`, etc. to TypeScript
2. **Resolve typecheck errors** — Address vue-router-auto, component type declarations
3. **Debug E2E service worker** — Service worker initialization hangs; add explicit wait or lifecycle hooks
4. **Add component unit tests** — Start with core components (Flex, Text, MaterialIcon), then popups

**Medium-term:**

1. **Store integration tests** — Test login flow, network switch, account selection
2. **Routing tests** — Auth guards, page transitions, browser history
3. **E2E fix pass** — Once fixtures are stable, add dApp interaction tests (blocked by startup issues)

**Long-term:**

1. **Visual regression** — Screenshot-based component testing
2. **Performance profiling** — Service worker startup time, popup render time
3. **Accessibility audit** — WCAG compliance for UI components

---

## Appendix: File Inventory

### Key configuration files

- `/vite.config.ts` — Primary Vite config (200 lines)
- `/vite.chrome.config.mts` — Chrome-specific (MV3, crx plugin)
- `/vite.firefox.config.mts` — Firefox-specific (MV2 compat)
- `/vitest.config.ts` — Unit test config
- `/vitest.e2e.config.ts` — E2E test config
- `/tsconfig.json` — TypeScript strict mode
- `/biome.json` — Linter/formatter rules

### Source structure

- `src/popup/app.vue` — Root app component (auth checks, settings sync)
- `src/popup/pages/` — 32 routable pages (via vite-plugin-pages)
- `src/popup/windows/` — 7 modal windows (capabilities, execute, passkey, verify, etc.)
- `src/popup/components/` — 46 reusable Vue components
- `src/stores/` — 4 Pinia stores (app, popup, cache, notification)
- `src/composables/` — 4 Vue composables (notification, toast, syncedRef, configClient)
- `src/components/core/` — 4 core layout components (Flex, Text, Icon, MaterialIcon)
- `src/components/ui/` — 31 UI components (buttons, inputs, dropdowns, modals)
- `src/wallet/` — 30+ service implementations (background worker)

### Build output

- `dist/chrome/` — Chrome MV3 extension (manifest.json, service-worker-loader.js, assets/)
- `dist/firefox/` — Firefox WebExtension (if built with firefox config)

