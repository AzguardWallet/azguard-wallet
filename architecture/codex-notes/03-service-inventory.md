# 03 Service Inventory

## Scope

This note inventories the concrete services booted by the extension today.

- Worker services are registered in [`packages/extension/src/wallet/index.ts:79`](../../packages/extension/src/wallet/index.ts#L79) through [`src/wallet/index.ts:97`](../../packages/extension/src/wallet/index.ts#L97)
- The offscreen runtime registers only [`PxeService`](../../packages/extension/src/wallet/services/pxe/service.ts#L62) in [`packages/extension/src/offscreen/index.ts:37`](../../packages/extension/src/offscreen/index.ts#L37)

I count **20 concrete services**:

- 19 in the service worker
- 1 in the offscreen document

`wallet-sdk/background.ts` is important orchestration, but it is not a `Service` subclass and is therefore not included in this count.

## Graph summary

### Highest-coupling services

By direct service dependencies in `init()`:

1. [`ExecutionService`](../../packages/extension/src/wallet/services/execution/service.ts#L155) depends on 9 other worker services plus `PxeServiceClient`
2. [`TokenBalanceService`](../../packages/extension/src/wallet/services/token-balance/service.ts#L24) depends on 7 worker services
3. [`AuthRegistryService`](../../packages/extension/src/wallet/services/auth-registry/service.ts#L20) depends on 6 worker services
4. [`DappInteractionService`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L35) depends on 5 worker services
5. [`TokenService`](../../packages/extension/src/wallet/services/token/service.ts#L32) depends on 4 worker services plus `PxeServiceClient`

### Root services

These services are foundational and many others scope themselves off their state:

- [`ProfileService`](../../packages/extension/src/wallet/services/profile/service.ts#L26)
- [`NetworkService`](../../packages/extension/src/wallet/services/network/service.ts#L15)
- [`AccountService`](../../packages/extension/src/wallet/services/account/service.ts#L15)
- [`TaskService`](../../packages/extension/src/wallet/services/task/service.ts#L24)

### Persistence split

- `EntityStorage` / `ValueStorage` backed services: profile, network, account, contact, dapp-session, token, token-balance, transaction, auth-registry, fpc
- in-memory services: passkey pending requests, task tree, dapp-interaction pending approvals, logger/log-viewer fanout
- offscreen IndexedDB / PXE-backed: `PxeService`

## Inventory

| Service | Context | Responsibility | State / storage | Direct deps | Coupling notes |
| --- | --- | --- | --- | --- | --- |
| [`ConfigService`](../../packages/extension/src/wallet/services/config/service.ts#L10) | worker | Exposes config store over RPC and re-emits config updates | wraps `ConfigStore`, no own storage | none | Very thin adapter. Low architectural risk. |
| [`LoggerService`](../../packages/extension/src/wallet/services/logger/service.ts#L8) | worker | Central log sink for popup/offscreen/content contexts | `LoggerStore` owned by worker | none | Critical hidden dependency because every other context logs through it. |
| [`LogViewerService`](../../packages/extension/src/wallet/services/log-viewer/service.ts#L9) | worker | Streams logs to UI and clears log store | in-memory view over `LoggerStore` | none | Pure observability service; subscribes to store events in constructor. |
| [`PasskeyService`](../../packages/extension/src/wallet/services/passkey/service.ts#L10) | worker | Opens passkey popup windows and resolves WebAuthn PRF requests | in-memory `pending` map | none | Popup-window orchestration service. No persistence, so requests are restart-fragile. |
| [`ProfileService`](../../packages/extension/src/wallet/services/profile/service.ts#L26) | worker | Profile CRUD, password/passkey unlock, active session, master secret access | `profiles` in local storage; `session` in session storage; active secret in memory | `PasskeyService` | One of the true roots. Deletion and active-session changes fan out across the whole app. Stores password `passhash` in session storage on unlock. |
| [`NetworkService`](../../packages/extension/src/wallet/services/network/service.ts#L15) | worker | Network CRUD, default network selection, node client cache, chain-id probing | `EntityStorage<Network>` + in-memory `Map<chainId, AztecNode>` | `ProfileService` | Another root. Seeds default RPCs on first use in [`network/service.ts:53`](../../packages/extension/src/wallet/services/network/service.ts#L53). Clears all cached node clients on profile switch. |
| [`AccountService`](../../packages/extension/src/wallet/services/account/service.ts#L15) | worker | Deterministic account creation and lookup, account visibility/name, account contract adapter creation | `EntityStorage<Account>` | `ProfileService` | Derives chain/profile/type/index-scoped secrets and wraps the canonical Schnorr account. Core identity boundary between profile secret and usable account contract. |
| [`ContactService`](../../packages/extension/src/wallet/services/contact/service.ts#L14) | worker | Contact CRUD/import/export scoped to active profile | `EntityStorage<Contact>` + `Lock` | `ProfileService` | Mostly simple CRUD. Profile-scoped and deleted eagerly on profile deletion. |
| [`DappSessionService`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L22) | worker | Persists dApp connection/session records, expiries, capability grants/rejections | `EntityStorage<DappSession>` + `Lock` | `ProfileService` | Session store for both legacy permissions and newer capability grants. Expiry cleanup is eager and mutating. |
| [`DappInteractionService`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L35) | worker | Validates dApp requests, decides silent vs approval flow, opens approval windows, resolves/rejects pending interactions | in-memory `Map<string, DappInteraction>` + `Lock` | `ProfileService`, `NetworkService`, `AccountService`, `DappSessionService`, `ExecutionService` | Approval orchestrator. Holds pending interactions only in memory, so worker restarts drop pending approvals. Bridges CAIP accounts/chains into local ids. |
| [`TaskService`](../../packages/extension/src/wallet/services/task/service.ts#L24) | worker | In-memory task tree for long-running UX progress | in-memory `Map<string, Task>` | `ProfileService` | UI feedback service, not durable job orchestration. Clears tasks on profile change and expires them after 60 minutes. |
| [`TransactionService`](../../packages/extension/src/wallet/services/transaction/service.ts#L29) | worker | Persists submitted tx metadata and polls node receipts until status changes | `EntityStorage<Tx>` + in-memory `pending` map | `ProfileService`, `AccountService`, `NetworkService`, `PxeServiceClient` | Polling worker loop runs forever in [`transaction/service.ts:128`](../../packages/extension/src/wallet/services/transaction/service.ts#L128). Core source of truth for tx history and completion events. |
| [`TokenService`](../../packages/extension/src/wallet/services/token/service.ts#L32) | worker | Token registry, interface discovery, metadata fetch, token CRUD | `EntityStorage<Token>` + `Lock` | `ProfileService`, `NetworkService`, `AccountService`, `TaskService`, `PxeServiceClient` | A mixed metadata/discovery service. Knows contract introspection, token ABI matching, and also owns persisted token definitions. |
| [`TokenBalanceService`](../../packages/extension/src/wallet/services/token-balance/service.ts#L24) | worker | Materializes per-account/per-token balances and refreshes them in batches | `EntityStorage<TokenBalanceRaw>` + queue + caches + pending task map | `ProfileService`, `NetworkService`, `AccountService`, `TokenService`, `TransactionService`, `ExecutionService`, `TaskService` | Background worker loop plus event-driven refresh logic. Strongly coupled to task UX and transaction semantics. |
| [`FpcService`](../../packages/extension/src/wallet/services/fpc/service.ts#L26) | worker | Stores fee-payment contracts, auto-discovers protocol FPCs, exposes typed FPC handlers | `EntityStorage<FpcInfo>` + `Lock` | `ProfileService`, `NetworkService`, `PxeServiceClient` | More than CRUD: it auto-registers canonical SponsoredFPC / PrivateFPC in PXE and infers type from artifact shape. |
| [`AuthRegistryService`](../../packages/extension/src/wallet/services/auth-registry/service.ts#L20) | worker | Tracks public authwits locally, syncs auth-registry on-chain state, revokes authwits, toggles registry | two `EntityStorage`s + `Lock` | `ProfileService`, `NetworkService`, `AccountService`, `ExecutionService`, `TransactionService`, `TaskService` | Cross-cutting service tying execution, transaction waiting, on-chain reads, and local tracking together. |
| [`AccountStateService`](../../packages/extension/src/wallet/services/account-state/service.ts#L22) | worker | Read/write “debug” PXE state: registered accounts, senders, contracts; backup/restore PXE state | no own storage, PXE-backed | `NetworkService`, `PxeServiceClient` | Operational/maintenance service. Mostly a thin PXE proxy with backup/restore logic. |
| [`NoteService`](../../packages/extension/src/wallet/services/note/service.ts#L13) | worker | Reads private notes from PXE and projects them into simplified note rows | no own storage, PXE-backed | `NetworkService`, `PxeServiceClient` | Read-only facade over PXE debug note queries. |
| [`ExecutionService`](../../packages/extension/src/wallet/services/execution/service.ts#L155) | worker | Main transaction and simulation pipeline: builds actions, registers contracts, estimates fees, proves txs, submits txs, exposes Aztec/nulo operations | no own persistent storage; in-memory gas-balance cache | `ProfileService`, `NetworkService`, `AccountService`, `ContactService`, `TokenService`, `FpcService`, `TransactionService`, `AuthRegistryService`, `TaskService`, `PxeServiceClient` | The main God service. Owns fee logic, contract registration, authwit discovery, send/simulate/profile flows, gas balance queries, and transaction history projection. |
| [`PxeService`](../../packages/extension/src/wallet/services/pxe/service.ts#L62) | offscreen | Owns PXE instances and Aztec node clients per chain, serializes access to PXE, resolves artifacts/instances, proves/simulates txs | in-memory maps + IndexedDB-backed PXE data dirs | `ProfileServiceClient`, `ConfigServiceClient`, `LoggerServiceClient` | Clean runtime boundary but still a large subsystem. Clears all PXE/node caches on active profile change and deletes PXE DBs on profile deletion. |

## Architectural slices

### Identity and session

- `ProfileService`
- `PasskeyService`
- `AccountService`

These services own the wallet’s root secret, session unlock state, and deterministic account derivation. Everything else assumes they are correct.

### Network and PXE substrate

- `NetworkService`
- `PxeService`
- `AccountStateService`
- `NoteService`

These services decide where the wallet talks and what the local PXE knows.

### dApp connectivity and authorization

- `DappSessionService`
- `DappInteractionService`
- `AuthRegistryService`

This slice spans stored dApp permissions, ephemeral approval prompts, and authwit/on-chain authorization state. It is currently split across three services with different durability guarantees.

### Assets, balances, and fees

- `TokenService`
- `TokenBalanceService`
- `FpcService`

This slice owns token metadata, balance materialization, and fee-payment strategy discovery. It is more dynamic than it first appears because it depends heavily on simulation, node state, and PXE registration.

### Execution and activity

- `ExecutionService`
- `TransactionService`
- `TaskService`

This is the operational center of the wallet. `ExecutionService` does the work, `TransactionService` tracks the result, and `TaskService` gives the UI a progress tree.

### Observability and config

- `ConfigService`
- `LoggerService`
- `LogViewerService`

These are infrastructural and mostly well-isolated, though logging is an implicit dependency of every other context.

## Coupling hotspots

### 1. `ExecutionService` is the main God service

Evidence:

- direct dependency fan-in in [`execution/service.ts:177`](../../packages/extension/src/wallet/services/execution/service.ts#L177)
- owns public send flow, aztec.js send flow, fee estimation, utility simulation, view simulation, gas balance queries, authwit discovery, contract registration, and tx history projection across [`execution/service.ts:279`](../../packages/extension/src/wallet/services/execution/service.ts#L279), [`execution/service.ts:624`](../../packages/extension/src/wallet/services/execution/service.ts#L624), and [`execution/service.ts:1718`](../../packages/extension/src/wallet/services/execution/service.ts#L1718)

This is the strongest modularity problem in the codebase.

### 2. `ProfileService` is the hidden root of app scoping

Many services key their behavior off the active profile or profile deletion events:

- `NetworkService` clears node cache on profile change in [`network/service.ts:284`](../../packages/extension/src/wallet/services/network/service.ts#L284)
- `TaskService` clears in-memory tasks on profile change in [`task/service.ts:237`](../../packages/extension/src/wallet/services/task/service.ts#L237)
- `TokenBalanceService` rebuilds token cache on profile change in [`token-balance/service.ts:148`](../../packages/extension/src/wallet/services/token-balance/service.ts#L148)
- `PxeService` clears PXE/node caches on profile change in [`pxe/service.ts:483`](../../packages/extension/src/wallet/services/pxe/service.ts#L483)

The extension does not have a separate “session scope” abstraction; it uses `ProfileService` events as that mechanism.

### 3. `TokenBalanceService` is a second orchestration hub

It subscribes to profile, account, token, and transaction events in [`token-balance/service.ts:59`](../../packages/extension/src/wallet/services/token-balance/service.ts#L59) and runs a batching worker in [`token-balance/service.ts:233`](../../packages/extension/src/wallet/services/token-balance/service.ts#L233).

This service mixes:

- materialized read model storage
- task UX
- background job queue
- execution-time view simulation

That is more responsibility than its name suggests.

### 4. `DappInteractionService` and `PasskeyService` are ephemeral by design

Both hold pending requests only in memory:

- dApp interactions in [`dapp-interaction/service.ts:40`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L40)
- passkey requests in [`passkey/service.ts:13`](../../packages/extension/src/wallet/services/passkey/service.ts#L13)

Under MV3 worker suspension or restart, these workflows are not durable.

## Read on service quality

### Stronger seams

- `ConfigService`, `LoggerService`, `LogViewerService`
- `AccountStateService`, `NoteService`
- `PasskeyService`

These services are narrow and relatively easy to reason about.

### Medium-complexity services with manageable scope

- `AccountService`
- `ContactService`
- `NetworkService`
- `DappSessionService`
- `FpcService`
- `TransactionService`

They still have real state and side effects, but their boundaries are visible.

### Services that should be split

- `ExecutionService`
- `TokenBalanceService`
- `ProfileService`
- `PxeService`
- `DappInteractionService`

These are the services most likely to block unit-testability and future modularization.

## Concrete remediation opportunities

1. Split `ExecutionService` into pipeline stages.
Suggested seams: operation normalization, contract/artifact resolution, fee strategy, tx request builder, prove/send executor, authwit discovery.
Risk: high  
Size: weeks

2. Turn `TokenBalanceService` into a read-model updater backed by explicit jobs.
Keep storage projection separate from queueing and simulation execution.
Risk: medium  
Size: days to weeks

3. Introduce a first-class session scope object.
Let services depend on a stable `SessionContext` instead of directly subscribing to `ProfileService` events.
Risk: medium  
Size: days

4. Make approval/pending request state durable where user-visible.
At minimum for dApp approvals and passkey prompts.
Risk: medium  
Size: days

5. Isolate offscreen PXE management behind a thinner façade.
Keep `PxeService` as process owner, but move registry lookup, known-artifact bootstrapping, and chain cache policy into smaller collaborators.
Risk: medium  
Size: days to weeks
