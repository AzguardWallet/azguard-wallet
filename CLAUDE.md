# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Bun workspaces monorepo with 4 packages:

| Package | Path | Purpose |
|---------|------|---------|
| `@vibeguard/extension` | `packages/extension/` | Chrome/Firefox extension (Manifest V3) |
| `@vibeguard/contracts` | `packages/contracts/` | Noir smart contracts + pre-compiled artifacts |
| `@vibeguard/playground` | `packages/playground/` | Test dApp for e2e testing (scaffold) |
| `@vibeguard/landing` | `packages/landing/` | Marketing landing page (scaffold) |

## Build & Development Commands

```bash
# Root-level (delegates to packages)
bun run dev              # Start extension dev server (Chrome, port 8088)
bun run build            # Production build (Chrome)
bun run test             # Run vitest unit tests
bun run test:e2e         # Run Puppeteer E2E tests
bun run lint             # Run biome linter (all packages)
bun run lint:fix         # Auto-fix lint issues
bun run format           # Format all files with biome
bun run typecheck        # TypeScript check (vue-tsc)

# Package-level (from packages/extension/)
bun run dev:playground   # Start playground dev server (port 5174)
bun run dev:landing      # Start landing dev server (port 5175)
```

## Quality Tooling

- **Bun** is the package manager. No yarn/npm/pnpm.
- **Biome** handles both linting and formatting. Config in root `biome.json`.
- **Commitlint** enforces Conventional Commits (`feat:`, `fix:`, `chore:`, etc.). Config in `.commitlintrc.json`.
- **Pre-commit hook** (`.githooks/pre-commit`) runs `biome check --staged` on every commit.
- **Commit-msg hook** (`.githooks/commit-msg`) validates commit messages via commitlint.
- Hooks are auto-installed on `bun install` via the `prepare` script.
- `noExplicitAny` is enforced as an error — use `unknown` and cast at usage sites. Suppress with `// biome-ignore lint/suspicious/noExplicitAny: reason` only for genuinely untyped boundaries.

Load the extension in Chrome: `chrome://extensions` → Load unpacked → select `packages/extension/dist/chrome/`

## Naming Backward-Compatibility Constraints

The product was renamed from "Azguard" to "Vibeguard". The following MUST NOT be renamed:

- **Contract artifacts** (`azguard-v0.json`, `azguard-v0-persistent.json`): On-chain class identity. The names are embedded in compiled bytecode.
- **Passkey RP ID** (`azguardwallet.io`): WebAuthn credentials are bound to this. Changing it permanently locks users out.
- **KDF/PRF labels** (`azguard:kdf:v1`, `azguard:master:v1`, `azguard:profile:v1`): Domain separators in HKDF chain. Different labels = different keys = lost funds.
- **`azguardwallet.io` URLs**: Deferred until new domain is ready (marked with TODO comments).

## Contracts Package

The `@vibeguard/contracts` package contains:
- **Noir source** (`azguard-account/`, `azguard-account-persistent/`): Built with `nargo compile`. Requires Nargo installed.
- **Pre-compiled artifacts** (`artifacts/`): Committed JSON files for devs without Nargo.
- **TS wrapper** (`src/index.ts`): Exports typed artifacts for the extension to import.

The extension imports via: `import { vibeguardV0Artifact } from "@vibeguard/contracts"`

## Architecture Overview

Vibeguard Wallet is a Chrome extension (Manifest V3) for the Aztec network with privacy-first design.

### Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| Service Worker | `packages/extension/src/wallet/index.ts` | Background services, business logic |
| Popup UI | `packages/extension/src/popup/index.ts` | Vue 3 extension popup |
| Content Script | `packages/extension/src/content-script/content.ts` | Web page injection |
| Offscreen | `packages/extension/src/offscreen/index.ts` | PXE (Private Execution Environment) |

### Client/Service Communication Pattern

The core architecture uses a typed RPC-like pattern between popup UI and background service worker:

```
POPUP (Vue UI)                      BACKGROUND (Service Worker)
ServiceClient<Methods, Events>  ←→  Service<Methods, Events>
     └── chrome.runtime.connect() / RequestMessage / ResponseMessage
```

**Base classes:**
- `packages/extension/src/wallet/base/background/service.ts` - Server-side base
- `packages/extension/src/wallet/base/background/client.ts` - Client-side base
- `packages/extension/src/wallet/base/messages.ts` - Message schema

**Example:** `AccountServiceClient` (popup) communicates with `AccountService` (background) via typed method calls.

### Directory Structure

```
packages/extension/src/
├── wallet/           # Service worker - all background services
│   ├── services/     # 20+ services (account, profile, network, transaction, etc.)
│   ├── storage/      # Chrome storage abstraction (EntityStorage, ValueStorage)
│   └── config/       # Config with stealth mode settings
├── popup/            # Vue 3 popup application
│   ├── pages/        # File-based routing (vite-plugin-pages)
│   ├── components/   # Feature modules & popup dialogs
│   └── windows/      # Side panel & standalone windows
├── stores/           # Pinia state (app.store.ts, popup.store.ts, cache.store.ts)
├── composables/      # Vue composables (toast, externalLinks, etc.)
├── components/       # Global UI components (Flex, Text, Icon, etc.)
└── content-script/   # Content script & in-page injection
```

### Key Patterns

**Test placement:** Unit tests are colocated — `foo.test.ts` sits next to `foo.ts`. Do not use `__tests__/` directories. E2E tests live in `packages/extension/tests/e2e/`.

**Route meta for auth:**
```vue
<route lang="json">
{ "meta": { "isAuthRequired": true } }
</route>
```

**Config service for settings:**
```javascript
const configService = new ConfigServiceClient()
const value = await configService.getValue("externalLinks")
await configService.setValue("stealthMode", true)
```

**Confirmation dialogs:**
```javascript
cacheStore.confirm.title = "Confirm Action?"
cacheStore.confirm.description = "Description text"
cacheStore.confirm.confirm_text = "Yes"
cacheStore.confirm.callback = () => { /* action */ }
popupStore.open("confirm")
```

**Toast notifications:**
```javascript
const { openToast } = useToast()
openToast({ label: "Message", icon: "copy" }, 2_000)
```

### Auto-Imports (vite config)

These are auto-imported, no explicit imports needed:
- Vue APIs: `ref`, `computed`, `watch`, `onMounted`, etc.
- Vue Router: `useRoute`, `useRouter`
- Composables from `src/composables/`
- Stores from `src/stores/`
- Components from `src/components/`

### Privacy/Stealth Mode

Default config (`packages/extension/src/wallet/config/config.ts`) is privacy-first:
- `stealthMode: true` - Master toggle for external services
- `contractRegistry: false` - External contract lookups
- `walletConnectEnabled: false` - WalletConnect connections
- `uploadExternalImages: false` - External image loading
- `externalLinks: "disabled"` - External link behavior ("disabled" | "confirm" | "enabled")

Privacy settings page: `packages/extension/src/popup/pages/settings/external-services/index.vue`

### Privacy Composables

**Shared config state** (`src/composables/configClient.ts`):
```javascript
import { externalLinks, uploadExternalImages, initConfigClient } from "@/composables/configClient"

await initConfigClient() // Call once before accessing refs
// externalLinks.value and uploadExternalImages.value are reactive
```

**External links** (`src/composables/externalLinks.ts`):
```javascript
const { handleExternalLink } = useExternalLink()
// In template: @click="handleExternalLink($event, url)"
```
Behavior based on `externalLinks` config: copies to clipboard, shows confirmation, or opens directly.

**External images** (`src/composables/externalImage.ts`):
```javascript
const { loadExternalImage, privacyPlaceholder } = useExternalImage()
const imageUrl = await loadExternalImage(externalUrl)
// Returns blob URL if allowed, privacy placeholder SVG if disabled
```

**Ticker** (`src/composables/ticker.ts`):
```javascript
const now = useTicker(60_000) // Shared reactive timestamp, updates every 60s
// Use for relative time display (e.g., "5 minutes ago")
```

### Vue SFC Ordering Convention

Components follow execution-order-based ordering. This ensures code reads in the order it actually runs.

**Block order:**
```vue
<route lang="json">        <!-- 1. Route meta (pages only) -->
</route>

<script setup>            <!-- 2. Script -->
</script>

<template>                <!-- 3. Template -->
</template>

<style module>            <!-- 4. Styles -->
</style>
```

**Inside `<script setup>` — ordered by execution flow:**

```javascript
/** 1. Imports (grouped with comment headers) */
/** Services */
import { TokenServiceClient } from "@/wallet/services/token/client"

/** Components */
import Navigation from "./Navigation.vue"

/** Utils */
import { formatAddress } from "@/utils/string"

/** 2. Macros (compiler-processed first) */
const emit = defineEmits(["update:modelValue"])
const props = defineProps({ ... })
defineExpose({ inputEl })

/** 3. Store instantiation */
const appStore = useAppStore()
const cacheStore = useCacheStore()

/** 4. Composables */
const { openToast } = useToast()
const { handleExternalLink } = useExternalLink()

/** 5. Router/Route */
const route = useRoute()
const router = useRouter()

/** 6. Reactive state (refs, reactive, computed) */
const isLoading = ref(true)
const items = ref([])
const itemCount = computed(() => items.value.length)

/** 7. Service clients + event subscriptions */
const tokenService = new TokenServiceClient()
tokenService.onTokenUpdated.add(onTokenUpdated)
function onTokenUpdated(token) { ... }

/** 8. Functions/Handlers */
const handleClick = () => { ... }
const handleSubmit = async () => { ... }

/** 9. Watchers (watch, watchEffect) */
watch(() => props.modelValue, (val) => { ... })
watchEffect(() => { ... })

/** 10. Lifecycle hooks (in execution order) */
onBeforeMount(async () => { ... })
onMounted(() => { ... })
onBeforeUnmount(() => { ... })
onUnmounted(() => { ... })
```

**Rationale:** This order mirrors Vue's execution flow:
- Imports → available immediately
- Macros → processed at compile time
- Stores/composables → setup dependencies
- Refs → reactive state initialization
- Services → external subscriptions
- Functions → defined before use
- Watchers → registered after state exists
- Lifecycle → hooks in chronological order
