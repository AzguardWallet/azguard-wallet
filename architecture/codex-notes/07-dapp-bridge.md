# 07 dApp Bridge

## Scope

This note covers the extension-side dApp bridge:

- page discovery and secure-channel establishment
- content-script and service-worker message flow
- Nulo’s session and capability model on top of wallet-sdk
- approval windows for connect, capability grant, and execute
- the full `sendTransaction` / `sendTx` path from dApp call to background execution

This note is based on both local extension code and the installed `@aztec/wallet-sdk` package that the extension depends on.

## Architectural summary

Nulo does **not** inject an EIP-1193-style provider object from `src/`.

Instead, the bridge works like this:

1. The dApp-side wallet-sdk library broadcasts discovery with `window.postMessage(...)`
2. The extension content script relays that to the service worker
3. The worker uses wallet-sdk’s `BackgroundConnectionHandler` to manage discovery, key exchange, and encrypted session transport
4. Nulo layers its own `DappSessionService`, `DappInteractionService`, and `WalletSdkDispatcher` on top of that transport
5. Approval windows are opened as extension popups and feed decisions back into the worker

That means the extension’s “in-page bridge” is protocol-based discovery plus a transferred `MessagePort`, not a global injected object owned by this package.

## Real entry points and protocol surfaces

### Page side

The dApp-side extension provider in wallet-sdk sends discovery by posting JSON to the page:

- `ExtensionProvider.discoverWallets(...)` emits `window.postMessage(jsonStringify(discoveryMessage), "*")` in [`node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_provider.ts:170`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_provider.ts#L170) through [`extension_provider.ts:230`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_provider.ts#L230)
- once discovery is approved, the dApp receives a `MessagePort`, performs ECDH, and then sends encrypted wallet method calls through `ExtensionWallet` in [`extension_wallet.ts:101`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_wallet.ts#L101) through [`extension_wallet.ts:227`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_wallet.ts#L227)

### Content script

The extension content script is deliberately tiny:

- it instantiates `ContentScriptConnectionHandler` in [`packages/extension/src/content-script/content.ts:9`](../../packages/extension/src/content-script/content.ts#L9)
- the handler listens for page `message` events, forwards discovery to the worker, creates `MessageChannel`s on approval, and relays encrypted payloads in [`node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/content_script_connection_handler.ts:83`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/content_script_connection_handler.ts#L83) through [`content_script_connection_handler.ts:246`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/content_script_connection_handler.ts#L246)

The content script is a relay only. It does not hold session keys or evaluate permissions.

### Service worker

The worker initializes Nulo’s wallet-sdk integration after the main service graph starts in [`packages/extension/src/wallet/index.ts:102`](../../packages/extension/src/wallet/index.ts#L102) through [`wallet/index.ts:103`](../../packages/extension/src/wallet/index.ts#L103).

`initWalletSdkHandler(...)` then wires:

- `BackgroundConnectionHandler` from wallet-sdk
- `WalletSdkDispatcher`
- `DappInteractionService`
- `DappSessionService`

in [`packages/extension/src/wallet/services/wallet-sdk/background.ts:51`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L51) through [`background.ts:251`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L251).

## Discovery and connect flow

### 1. Discovery arrives

`BackgroundConnectionHandler` records each discovery request as a pending discovery keyed by request ID in [`background_connection_handler.ts:228`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L228) through [`background_connection_handler.ts:240`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L240).

Nulo’s `handleDiscovery(...)` then decides what to do in [`packages/extension/src/wallet/services/wallet-sdk/background.ts:264`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L264):

- if the wallet is locked, queue the discovery in `DiscoveryQueue` in [`background.ts:276`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L276) through [`background.ts:279`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L279)
- if a valid dApp session already exists for the origin, auto-approve in [`background.ts:282`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L282) through [`background.ts:287`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L287)
- if another popup for the same origin is already pending, await it and then auto-approve in [`background.ts:290`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L290) through [`background.ts:300`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L300)
- otherwise, open a discovery approval popup via `DappInteractionService.discover(...)` in [`background.ts:303`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L303) through [`background.ts:344`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L344)

### 2. First-time approval creates a local session

If the user approves connection:

- Nulo creates a `DappSession` with empty accounts and permissive chain metadata in [`background.ts:327`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L327) through [`background.ts:339`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L339)
- `DappSessionService.addDappSession(...)` persists it for 7 days in `nulo:core:dappSessions` in [`packages/extension/src/wallet/services/dapp-session/service.ts:93`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L93) through [`dapp-session/service.ts:123`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L123)

Important details:

- sessions are keyed to the active profile via `profileId` in [`dapp-session/service.ts:113`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L113) through [`dapp-session/service.ts:120`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L120)
- new sessions start with `accounts: []`, so account access is a later capability grant, not part of connect
- capability grants are initialized to `[]`, which means non-exempt methods are blocked until the dApp calls `requestCapabilities()` in [`background.ts:337`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L337) through [`background.ts:339`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L339)

### 3. Key exchange and verification

After discovery approval:

- wallet-sdk reuses the discovery request ID as the session ID in [`background_connection_handler.ts:249`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L249) through [`background_connection_handler.ts:260`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L260)
- the dApp establishes an encrypted channel with a hard 2 second key-exchange timeout in [`extension_provider.ts:56`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_provider.ts#L56) through [`extension_provider.ts:103`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_provider.ts#L103)
- the worker records the verification hash in the persisted dApp session in [`packages/extension/src/wallet/services/wallet-sdk/background.ts:122`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L122) through [`background.ts:125`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L125)
- Nulo may then open a verification popup in [`background.ts:131`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L131) through [`background.ts:141`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L141)

The verification window shows emoji derived from the wallet-sdk verification hash and can mark the session as trusted for reconnects in [`packages/extension/src/popup/windows/verify/index.vue:74`](../../packages/extension/src/popup/windows/verify/index.vue#L74) through [`verify/index.vue:79`](../../packages/extension/src/popup/windows/verify/index.vue#L79).

## Capability model

### Type-level capability enforcement

Before dispatching any wallet method, `WalletSdkDispatcher.dispatch(...)` enforces capability grants in [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts:173`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L173) through [`dispatcher.ts:178`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L178).

The required method-to-capability mapping lives in [`packages/extension/src/wallet/services/wallet-sdk/capability-map.ts:17`](../../packages/extension/src/wallet/services/wallet-sdk/capability-map.ts#L17):

- `sendTx` requires `transaction`
- `simulateTx` / `executeUtility` / `profileTx` / `simulateViews` require `simulation`
- `getPrivateEvents` / `getAddressBook` / `registerSender` require `data`
- `getCompleteAddress` / `createAuthWit` / `registerToken` require `accounts`

The actual enforcement is in [`dispatcher.ts:538`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L538) through [`dispatcher.ts:552`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L552).

### Scope-level enforcement

After type enforcement, the dispatcher applies per-operation scope checks in [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts:223`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L223) through [`scope-enforcement.ts:237`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L237).

This is what limits:

- which contracts `registerContract` can touch
- which contract/function pairs `sendTx` can call
- which utilities or simulations are allowed
- which contracts can be queried for private events

There is an explicit gap already noted in code: `createAuthWit` currently checks account scope but does **not** yet validate the call target scope when the intent contains a call in [`scope-enforcement.ts:202`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L202) through [`scope-enforcement.ts:203`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L203).

### Capability approval popup

`requestCapabilities()` follows a 3-phase flow in [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts:345`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L345) through [`dispatcher.ts:489`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L489):

1. load existing grants and rejections
2. compute a delta of newly requested or re-requested capabilities
3. if needed, open a capability popup

The popup:

- displays only delta capabilities as toggleable items in [`packages/extension/src/popup/windows/capabilities/index.vue:167`](../../packages/extension/src/popup/windows/capabilities/index.vue#L167) through [`capabilities/index.vue:200`](../../packages/extension/src/popup/windows/capabilities/index.vue#L200)
- handles account sharing separately from general capability cards in [`capabilities/index.vue:154`](../../packages/extension/src/popup/windows/capabilities/index.vue#L154) through [`capabilities/index.vue:165`](../../packages/extension/src/popup/windows/capabilities/index.vue#L165)
- returns selected CAIP accounts and aliases on approval in [`capabilities/index.vue:262`](../../packages/extension/src/popup/windows/capabilities/index.vue#L262) through [`capabilities/index.vue:278`](../../packages/extension/src/popup/windows/capabilities/index.vue#L278)

The worker then merges approved capabilities, rejected capability types, selected accounts, and aliases back into the persisted dApp session in [`dispatcher.ts:434`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L434) through [`dispatcher.ts:483`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L483).

## Execute approval flow

### Worker-side orchestration

All approval windows go through `DappInteractionService`:

- `interaction(...)` creates an in-memory interaction object
- stores it in `Map<string, DappInteraction>`
- opens `src/popup/index.html#/windows/${type}?requestId=...`

in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:139`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L139) through [`dapp-interaction/service.ts:196`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L196).

This applies to:

- discovery popups
- capability popups
- execute popups

### Execute popup behavior

The execute window reads the interaction payload and reconstructs UI-facing operations in [`packages/extension/src/popup/windows/execute/index.vue:108`](../../packages/extension/src/popup/windows/execute/index.vue#L108) through [`execute/index.vue:246`](../../packages/extension/src/popup/windows/execute/index.vue#L246).

It also:

- forces sign-in first by redirecting to `/popup/auth` when necessary in [`execute/index.vue:383`](../../packages/extension/src/popup/windows/execute/index.vue#L383) through [`execute/index.vue:401`](../../packages/extension/src/popup/windows/execute/index.vue#L401)
- resolves CAIP accounts/chains back into local network and account objects in [`execute/index.vue:135`](../../packages/extension/src/popup/windows/execute/index.vue#L135) through [`execute/index.vue:156`](../../packages/extension/src/popup/windows/execute/index.vue#L156)
- injects `feeSettings` into `send_transaction` and `aztec_sendTx` operations when embedded payment is not already present in [`execute/index.vue:201`](../../packages/extension/src/popup/windows/execute/index.vue#L201) through [`execute/index.vue:230`](../../packages/extension/src/popup/windows/execute/index.vue#L230)
- estimates operation fees by calling `ExecutionServiceClient.estimateOperationFee(...)` from the popup in [`execute/index.vue:72`](../../packages/extension/src/popup/windows/execute/index.vue#L72) through [`execute/index.vue:94`](../../packages/extension/src/popup/windows/execute/index.vue#L94)
- sends approval back to the worker with `approveInteraction(...)` in [`execute/index.vue:260`](../../packages/extension/src/popup/windows/execute/index.vue#L260) through [`execute/index.vue:272`](../../packages/extension/src/popup/windows/execute/index.vue#L272)

This is the approval point for dApp-originated transactions.

### `sendTx` request path end-to-end

The full `sendTx` path is:

1. dApp wallet-sdk calls `wallet.sendTx(...)`, which encrypts a method call and posts it on the `MessagePort` in [`extension_wallet.ts:203`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_wallet.ts#L203) through [`extension_wallet.ts:226`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/provider/extension_wallet.ts#L226)
2. content script relays encrypted payloads to the worker in [`content_script_connection_handler.ts:161`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/content_script_connection_handler.ts#L161) through [`content_script_connection_handler.ts:189`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/content_script_connection_handler.ts#L189)
3. `BackgroundConnectionHandler` decrypts and hands the wallet message to Nulo in [`background_connection_handler.ts:323`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L323) through [`background_connection_handler.ts:331`](../../node_modules/.bun/@aztec+wallet-sdk@4.2.0-nightly.20260413/node_modules/@aztec/wallet-sdk/src/extension/handlers/background_connection_handler.ts#L323)
4. Nulo serializes handling per session with both `sessionQueues` and a monkey-patched decrypt queue in [`packages/extension/src/wallet/services/wallet-sdk/background.ts:80`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L80) through [`background.ts:86`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L86) and [`background.ts:164`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L164) through [`background.ts:182`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L182)
5. `handleWalletMessage(...)` resolves active profile and converts chain info into Nulo’s internal numeric chain ID using `chainId ^ version` in [`background.ts:378`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L378) through [`background.ts:392`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L392) and [`background.ts:453`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L453) through [`background.ts:457`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L457)
6. `WalletSdkDispatcher.handleSendTx(...)` resolves the session’s authorized account, normalizes `from`, detects the default-entrypoint no-`from` case, and converts the wallet-sdk call into an `AztecSendTxRequest` in [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts:299`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L299) through [`dispatcher.ts:341`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L341)
7. the dispatcher routes that request through `DappInteractionService.execute(...)` rather than straight to `ExecutionService`, specifically so the confirmation popup can collect fee settings in [`dispatcher.ts:336`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L336) through [`dispatcher.ts:341`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L341)
8. after approval, `DappInteractionService.approveInteraction(...)` deletes the interaction record and kicks execution in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:69`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L69) through [`dapp-interaction/service.ts:76`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L76)
9. `ExecutionService.executeAztecSendTx(...)` performs the same estimate/prove/send pipeline described in `06-tx-pipeline.md`
10. the result is JSON-sanitized and encrypted back to the dApp in [`background.ts:391`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L391) through [`background.ts:399`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L399)

## Session resolution rules

The dispatcher resolves the concrete account for account-scoped methods by:

- finding the default network for the session chain ID in [`packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts:732`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L732) through [`dispatcher.ts:738`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L738)
- loading all local accounts on that chain
- filtering to those listed in the dApp session’s CAIP accounts
- selecting the first authorized match

in [`dispatcher.ts:748`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L748) through [`dispatcher.ts:760`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L760).

That is workable, but it means the currently active popup account is not the authority for dApp execution; the persisted dApp session is.

## What is good

- The transport boundary is clean: discovery, ECDH, encrypted messages, and disconnects are delegated to wallet-sdk instead of reimplemented locally.
- The extension adds explicit concurrency guards for session message ordering. The `sessionQueues` plus decrypt monkey-patch are pragmatic fixes for a real race.
- Capability grants and account grants are explicitly persisted per profile and per origin.
- Execute, discover, and capability approval flows all use extension-owned popup windows, not page DOM overlays.
- The anti-phishing UI work is real: normalized hostname rendering and IDN warnings exist across connect/execute/verify windows.

## Current pressure points

1. There is no repo-local injected provider to audit because the bridge is externalized into wallet-sdk.
That is not inherently bad, but it means the extension’s security posture depends heavily on a moving dependency surface outside `src/`.

2. `DappInteractionService` keeps all pending interactions in memory only.
If the worker is terminated while a popup is open, the popup can come back with a `requestId` that no longer exists in [`dapp-interaction/service.ts:61`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L61) through [`dapp-interaction/service.ts:67`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L67).

3. The execute popup duplicates session-to-network/account resolution logic that also exists in `WalletSdkDispatcher`.
Compare [`execute/index.vue:135`](../../packages/extension/src/popup/windows/execute/index.vue#L135) through [`execute/index.vue:156`](../../packages/extension/src/popup/windows/execute/index.vue#L156) with [`dispatcher.ts:732`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L732) through [`dispatcher.ts:760`](../../packages/extension/src/wallet/services/wallet-sdk/dispatcher.ts#L760). This is shared logic implemented twice in different runtimes.

4. Connect approval creates a session before capability grant.
That is intentional, but it leaves a state where a dApp is “connected” yet functionally blocked until capabilities are requested. Engineers need to reason about two different permission layers: session existence and capability grants.

5. Account selection is “first authorized account” by default.
`resolveNetworkAndAccount(...)` picks the first matching authorized account. That works for single-account sessions, but it is an implicit selection policy.

6. Scope enforcement for `createAuthWit` is incomplete.
The TODO in [`scope-enforcement.ts:202`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L202) means auth witness creation is not fully constrained by call target scope yet.

7. The worker relies on monkey-patching a private wallet-sdk method.
The decryption serialization patch in [`background.ts:164`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L164) through [`background.ts:182`](../../packages/extension/src/wallet/services/wallet-sdk/background.ts#L182) is pragmatic but brittle against dependency upgrades.

## Recommendations flowing from this concern

1. Introduce a local `wallet-bridge` facade package around wallet-sdk.
Risk: medium. Size: days.
Wrap discovery, session lifecycle, and message dispatch behind Nulo-owned interfaces so wallet-sdk churn is isolated to one module.

2. Persist pending interaction descriptors.
Risk: medium. Size: days.
Store enough metadata to restore discovery/capability/execute popups across worker restart or at least fail them deterministically with a user-facing recovery path.

3. Move CAIP resolution into a shared module used by both dispatcher and popup windows.
Risk: low. Size: hours to days.
The execute popup should consume a serialized worker-prepared view model instead of re-resolving accounts and networks itself.

4. Replace “first authorized account” with explicit account binding for account-scoped sessions.
Risk: medium. Size: days.
If a session has multiple accounts, require the request or grant to identify which account is intended instead of silently taking the first one.

5. Finish scope enforcement for `createAuthWit`.
Risk: high. Size: hours.
This is a contained security-hardening patch and should be treated as a near-term fix.

6. Upstream or internalize the message-ordering fix.
Risk: medium. Size: days.
The current monkey-patch is acceptable as a stopgap, but production architecture should not depend on a private method name in a third-party package.

7. Add integration tests around the three approval windows and reconnect behavior.
Risk: medium. Size: days.
The critical behaviors are cross-context and stateful; unit tests alone will not catch regressions in discovery, reconnect, or popup cancellation.
