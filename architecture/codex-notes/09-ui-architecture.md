# 09 UI Architecture

## Scope

This note covers the popup/sidepanel/approval-window Vue application under `packages/extension/src/popup/`:

- boot sequence
- routing and guards
- Pinia store responsibilities
- the `managers` service-client singleton layer
- component/page/window structure
- where state actually lives

## Structural overview

The UI is one Vue 3 application reused across:

- the browser action popup
- the side panel
- standalone approval windows such as `discover`, `capabilities`, `execute`, `verify`, and `passkey`

The directory structure reflects that split:

- route pages under `packages/extension/src/popup/pages/`
- approval windows under `packages/extension/src/popup/windows/`
- reusable domain components under `packages/extension/src/popup/components/modules/`
- overlay/pop-up components under `packages/extension/src/popup/components/popups/`

The popup app is mounted once from [`packages/extension/src/popup/index.ts:19`](../../packages/extension/src/popup/index.ts#L19) through [`popup/index.ts:99`](../../packages/extension/src/popup/index.ts#L99).

## Boot path

### App creation

The UI boot file does four meaningful things:

1. installs popup-side logging hooks in [`popup/index.ts:1`](../../packages/extension/src/popup/index.ts#L1) through [`popup/index.ts:17`](../../packages/extension/src/popup/index.ts#L17)
2. builds a file-system router using `vue-router/auto` and `~pages` in [`popup/index.ts:21`](../../packages/extension/src/popup/index.ts#L21) through [`popup/index.ts:24`](../../packages/extension/src/popup/index.ts#L24)
3. applies global route guards in [`popup/index.ts:56`](../../packages/extension/src/popup/index.ts#L56) through [`popup/index.ts:97`](../../packages/extension/src/popup/index.ts#L97)
4. mounts `App.vue` with Pinia in [`popup/index.ts:99`](../../packages/extension/src/popup/index.ts#L99)

### Root shell responsibilities

`App.vue` is not just a layout component. It also performs most top-level application orchestration:

- theme and global config wiring in [`packages/extension/src/popup/app.vue:21`](../../packages/extension/src/popup/app.vue#L21) through [`app.vue:73`](../../packages/extension/src/popup/app.vue#L73)
- network initialization in [`app.vue:75`](../../packages/extension/src/popup/app.vue#L75) through [`app.vue:103`](../../packages/extension/src/popup/app.vue#L103)
- account initialization in [`app.vue:105`](../../packages/extension/src/popup/app.vue#L105) through [`app.vue:117`](../../packages/extension/src/popup/app.vue#L117)
- profile/session bootstrap in [`app.vue:176`](../../packages/extension/src/popup/app.vue#L176) through [`app.vue:217`](../../packages/extension/src/popup/app.vue#L217)
- background reconnect handling in [`app.vue:274`](../../packages/extension/src/popup/app.vue#L274) through [`app.vue:281`](../../packages/extension/src/popup/app.vue#L281)

This makes `App.vue` the UI process orchestrator, not a thin shell.

## Routing model

### File-system routing

Routes are generated from the file tree with `vue-router/auto` in [`popup/index.ts:21`](../../packages/extension/src/popup/index.ts#L21) through [`popup/index.ts:23`](../../packages/extension/src/popup/index.ts#L23). Route meta is declared inline inside SFCs with `<route lang="json">`.

Examples:

- popup send page marks `isAuthRequired` in [`packages/extension/src/popup/pages/send.vue:1`](../../packages/extension/src/popup/pages/send.vue#L1)
- passkey window opts out of auth and marks `isPasskeyInteraction` in [`packages/extension/src/popup/windows/passkey/index.vue:1`](../../packages/extension/src/popup/windows/passkey/index.vue#L1)

### Router guard behavior

The global `beforeEach` in [`popup/index.ts:56`](../../packages/extension/src/popup/index.ts#L56) enforces:

- passkey routes bypass normal auth bootstrap
- registered users cannot revisit `/popup/register`
- logged-in users cannot revisit `/popup/auth`
- auth-required routes redirect to auth when `appStore.isLogined` is false
- if no profile is selected, the guard queries `managers.profile.getProfiles()` and picks the last-active profile or the first profile before navigating

The route guard is therefore not purely declarative. It performs real async service calls and mutates the app store.

## State layers

There are three overlapping UI state layers:

1. Pinia stores
2. module-level service singletons in `utils/core.js`
3. direct Chrome storage reads/writes from components and stores

Understanding the UI requires tracking all three.

### 1. Pinia stores

There are four stores:

- `app.store.ts`
- `cache.store.ts`
- `popup.store.ts`
- `notification.store.ts`

#### `app` store

`useAppStore()` is the main application state container in [`packages/extension/src/stores/app.store.ts:42`](../../packages/extension/src/stores/app.store.ts#L42).

It owns:

- active profile and profile list
- active account and account list
- active network and network list
- login/session flags
- transactions and optimistic awaiting transactions
- connected dapp session list
- a few global UI flags such as `showRegisterPopup`

It also performs IO directly:

- persists active account to `chrome.storage.local` in [`app.store.ts:60`](../../packages/extension/src/stores/app.store.ts#L60) through [`app.store.ts:80`](../../packages/extension/src/stores/app.store.ts#L80)
- calls background service clients through `managers.*` in methods like `changeAccountVisibility`, `updateAccount`, `syncNetworkStatus`, and `syncTransactions` in [`app.store.ts:82`](../../packages/extension/src/stores/app.store.ts#L82) through [`app.store.ts:154`](../../packages/extension/src/stores/app.store.ts#L154)

So this store is not a pure state container. It mixes state, orchestration, persistence, and service access.

#### `cache` store

`useCacheStore()` is an ephemeral cross-route scratchpad in [`packages/extension/src/stores/cache.store.ts:11`](../../packages/extension/src/stores/cache.store.ts#L11).

It holds:

- selected entities for edit flows
- preselected send context
- fee method data
- import flow temporary objects and promises
- viewer data
- promo-derived privacy settings

This is effectively a global temporary data bus for flows that span pages or popups.

#### `popup` store

`usePopupStore()` is a lightweight overlay stack in [`packages/extension/src/stores/popup.store.ts:10`](../../packages/extension/src/stores/popup.store.ts#L10).

It tracks popup openness and payloads keyed by popup name. It is simple and local in scope.

#### `notification` store

`useNotificationStore()` is a queued modal/notification manager in [`packages/extension/src/stores/notification.store.ts:22`](../../packages/extension/src/stores/notification.store.ts#L22).

It serializes notifications through one active item plus a queue. This is one of the cleaner stores in the UI.

### 2. `managers` singleton layer

The UI also has a module-level client registry in [`packages/extension/src/utils/core.js:22`](../../packages/extension/src/utils/core.js#L22):

- `profile`
- `network`
- `transaction`
- `contact`

It eagerly constructs and connects some clients at module load:

- `ProfileServiceClient` in [`utils/core.js:14`](../../packages/extension/src/utils/core.js#L14)
- `ContactServiceClient` in [`utils/core.js:19`](../../packages/extension/src/utils/core.js#L19)

It also exposes:

- `isBackgroundConnected` as a module-global `ref` in [`utils/core.js:6`](../../packages/extension/src/utils/core.js#L6)
- `initTransactionService(...)` in [`utils/core.js:53`](../../packages/extension/src/utils/core.js#L53)
- `refreshBalances(...)` in [`utils/core.js:29`](../../packages/extension/src/utils/core.js#L29)

This singleton layer is effectively a second service container living outside Pinia and outside Vue injection.

### 3. Chrome storage as UI state

The popup process also uses `chrome.storage.local` directly for UI preferences:

- `nulo:ui:activeAccount` in [`app.store.ts:60`](../../packages/extension/src/stores/app.store.ts#L60)
- `nulo:ui:lastActiveProfile` via [`packages/extension/src/utils/lastActiveProfile.ts:5`](../../packages/extension/src/utils/lastActiveProfile.ts#L5)
- `nulo:ui:activeNetwork` and `nulo:ui:lastActiveNetwork@profileId` in [`app.vue:84`](../../packages/extension/src/popup/app.vue#L84) through [`app.vue:99`](../../packages/extension/src/popup/app.vue#L99)

So some UI state survives popup teardown independently of Pinia.

## Root UI composition

The root template in [`packages/extension/src/popup/app.vue:289`](../../packages/extension/src/popup/app.vue#L289) through [`app.vue:312`](../../packages/extension/src/popup/app.vue#L312) shows the overall composition:

- teleport roots for popup/tooltip/dropdown/popover/toast
- global managers: `PopupManager`, `ToastManager`, `NotificationManager`, `GlobalLoader`
- shared `Header`
- route content via `<RouterView>`
- bottom `Navigation` when route meta requests it

This is one unified shell reused for both normal pages and approval windows. The route meta `showBottomNav` decides whether the normal navigation chrome is present in [`app.vue:33`](../../packages/extension/src/popup/app.vue#L33) through [`app.vue:40`](../../packages/extension/src/popup/app.vue#L40) and [`app.vue:311`](../../packages/extension/src/popup/app.vue#L311).

## Data flow patterns

### Profile lifecycle

`App.vue` listens to `managers.profile.onActiveProfileChanged` in [`app.vue:177`](../../packages/extension/src/popup/app.vue#L177).

When a profile becomes active:

- it sets `appStore.profile`
- initializes networks
- initializes accounts
- initializes transaction subscriptions
- syncs transactions
- sets `appStore.isLogined = true`

in [`app.vue:157`](../../packages/extension/src/popup/app.vue#L157) through [`app.vue:173`](../../packages/extension/src/popup/app.vue#L173).

This means “active profile changed” is the real UI bootstrap event, more than route entry.

### Network/account cascade

Two root-level watchers in `App.vue` re-run substantial logic on account/network changes:

- account watcher syncs transactions in [`app.vue:119`](../../packages/extension/src/popup/app.vue#L119) through [`app.vue:129`](../../packages/extension/src/popup/app.vue#L129)
- network watcher reconnects account services, may auto-create an account if none exist, reselects the active account, and syncs transactions in [`app.vue:131`](../../packages/extension/src/popup/app.vue#L131) through [`app.vue:155`](../../packages/extension/src/popup/app.vue#L155)

This is functional, but heavy for root-level reactive watchers.

### Background liveness

The popup tracks background connectivity through the `isBackgroundConnected` ref in `utils/core.js`. `App.vue` watches it and re-runs `loadProfile()` whenever the worker reconnects in [`app.vue:274`](../../packages/extension/src/popup/app.vue#L274) through [`app.vue:281`](../../packages/extension/src/popup/app.vue#L281).

This is one of the key MV3 resilience mechanisms in the UI.

## Approval windows as routes

The approval windows are not a separate app. They are routes under `src/popup/windows/`:

- `discover`
- `capabilities`
- `execute`
- `verify`
- `passkey`
- `json`
- `logger`

They reuse the same router, same global app shell, and same Pinia stores, but most of them perform their own bootstrapping:

- wait for `appStore.isSessionChecked`
- redirect to `/popup/auth` if not logged in
- connect window-specific service clients

Examples:

- discover window in [`packages/extension/src/popup/windows/discover/index.vue:144`](../../packages/extension/src/popup/windows/discover/index.vue#L144) through [`discover/index.vue:171`](../../packages/extension/src/popup/windows/discover/index.vue#L171)
- execute window in [`packages/extension/src/popup/windows/execute/index.vue:379`](../../packages/extension/src/popup/windows/execute/index.vue#L379) through [`execute/index.vue:406`](../../packages/extension/src/popup/windows/execute/index.vue#L406)

So these windows are logically separate apps, but technically route variants inside one process-wide app.

## What is good

- The file-system route split between `pages/` and `windows/` is easy to navigate.
- Most domain UI is grouped under `components/modules/` rather than scattered through pages.
- The store split between durable app state, scratch state, popup stack, and notification queue is directionally sensible.
- The UI already handles MV3 background reconnection explicitly.
- Approval windows reuse the same component system and design language instead of duplicating a second frontend stack.

## Current pressure points

1. `App.vue` is a UI kernel, not a shell.
It owns theme/config, profile bootstrap, network init, account init, transaction subscription, reconnect behavior, session refresh, and routing side effects.

2. The `managers` singleton bypasses Vue dependency boundaries.
Components and stores can reach background service clients through a process-global object rather than injected interfaces or composables.

3. Store boundaries are porous.
`app.store.ts` performs IO and service orchestration directly, while `cache.store.ts` is a global bucket of unrelated flow state.

4. UI boot logic is duplicated across windows.
Several approval windows repeat the same “wait for session, redirect to auth, fetch payload” pattern.

5. Root watchers perform heavyweight mutations.
The network watcher recreates service clients and may auto-create accounts. That is more orchestration than a watcher should usually own.

6. Chrome storage is used ad hoc from multiple places.
Active profile/account/network preferences are persisted in different files with no single UI persistence abstraction.

## Recommendations flowing from this concern

1. Extract an explicit `ui-runtime` layer from `App.vue`.
Risk: medium. Size: days.
Move profile/network/account bootstrap, reconnect handling, and session refresh into composables or a dedicated runtime module.

2. Replace `managers` with injected service gateways.
Risk: medium. Size: days.
Use a Pinia plugin or Vue provide/inject service container so routes and composables can be tested without module-level singletons.

3. Split `app.store` into domain stores.
Risk: medium. Size: days to weeks.
At minimum separate `session/profile`, `network/account selection`, and `activity/transactions`. The current store is doing too much.

4. Replace `cache.store` with narrower flow-scoped composables where possible.
Risk: low to medium. Size: days.
Keep only truly cross-route transient state in Pinia; move one-off edit context closer to the flows that use it.

5. Create a shared approval-window bootstrap composable.
Risk: low. Size: hours.
`useApprovalWindow()` could centralize session wait, auth redirect, payload lookup, and cleanup.

6. Introduce a small UI persistence service.
Risk: low. Size: hours to days.
Wrap `chrome.storage.local` access for active profile/account/network so the persistence rules live in one place.
