# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
yarn dev              # Start dev server (Chrome, port 8088)
yarn build            # Production build (Chrome)
yarn test             # Run vitest tests
```

Load the extension in Chrome: `chrome://extensions` → Load unpacked → select `dist/chrome/`

## Architecture Overview

Azguard Wallet is a Chrome extension (Manifest V3) for the Aztec network with privacy-first design.

### Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| Service Worker | `src/wallet/index.ts` | Background services, business logic |
| Popup UI | `src/popup/index.ts` | Vue 3 extension popup |
| Content Script | `src/content-script/content.ts` | Web page injection |
| Offscreen | `src/offscreen/index.ts` | PXE (Private Execution Environment) |

### Client/Service Communication Pattern

The core architecture uses a typed RPC-like pattern between popup UI and background service worker:

```
POPUP (Vue UI)                      BACKGROUND (Service Worker)
ServiceClient<Methods, Events>  ←→  Service<Methods, Events>
     └── chrome.runtime.connect() / RequestMessage / ResponseMessage
```

**Base classes:**
- `src/wallet/base/background/service.ts` - Server-side base
- `src/wallet/base/background/client.ts` - Client-side base
- `src/wallet/base/messages.ts` - Message schema

**Example:** `AccountServiceClient` (popup) communicates with `AccountService` (background) via typed method calls.

### Directory Structure

```
src/
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

Default config (`src/wallet/config/config.ts`) is privacy-first:
- `stealthMode: true` - Master toggle for external services
- `contractRegistry: false` - External contract lookups
- `walletConnectEnabled: false` - WalletConnect connections
- `uploadExternalImages: false` - External image loading
- `externalLinks: "disabled"` - External link behavior ("disabled" | "confirm" | "enabled")

Privacy settings page: `src/popup/pages/settings/external-services/index.vue`

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
