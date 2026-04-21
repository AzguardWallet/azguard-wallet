# 05 PXE Integration

## Scope

This note covers how the extension embeds and uses Aztec PXE:

- offscreen runtime placement
- worker ↔ offscreen lifecycle
- per-chain PXE/node instantiation
- artifact / contract resolution
- proof and simulation entry points
- sync assumptions and concurrency behavior

## Runtime placement

PXE does not run in the MV3 service worker. It runs in the offscreen document:

- offscreen entry bootstraps only `PxeService` in [`packages/extension/src/offscreen/index.ts:37`](../../packages/extension/src/offscreen/index.ts#L37)
- the service worker creates that document lazily through `ensureOffscreenRunning()` in [`packages/extension/src/wallet/utils/offscreen.ts:101`](../../packages/extension/src/wallet/utils/offscreen.ts#L101)
- `PxeServiceClient` calls `ensureOffscreenRunning()` before every public method in [`packages/extension/src/wallet/services/pxe/client.ts:44`](../../packages/extension/src/wallet/services/pxe/client.ts#L44)

This is the correct high-level MV3 shape. Proof generation and PXE state are kept out of the suspendable worker process.

## Local API shape

Worker code does not talk to PXE directly. It talks to `PxeServiceClient`, usually via a network-bound `PXEProxy`:

- proxy interface in [`packages/extension/src/wallet/services/pxe/proxy.ts:14`](../../packages/extension/src/wallet/services/pxe/proxy.ts#L14)
- proxy creation in [`packages/extension/src/wallet/services/pxe/client.ts:35`](../../packages/extension/src/wallet/services/pxe/client.ts#L35)

So the local layering is:

1. worker service gets `Network`
2. worker service calls `pxeService.getPXE(network)`
3. proxy forwards to offscreen RPC with that network attached

That is a decent seam. It means most of the worker code reasons about “PXE per network”, not about offscreen lifecycle mechanics.

## Offscreen lifecycle

### Health-checked creation

`ensureOffscreenRunning()`:

- checks for an existing offscreen context via `chrome.runtime.getContexts()` in [`offscreen.ts:102`](../../packages/extension/src/wallet/utils/offscreen.ts#L102)
- pings it with `OFFSCREEN_PING` / `OFFSCREEN_PONG` in [`offscreen.ts:38`](../../packages/extension/src/wallet/utils/offscreen.ts#L38)
- kills and recreates zombie/ghost offscreen docs in [`offscreen.ts:76`](../../packages/extension/src/wallet/utils/offscreen.ts#L76)
- waits for `OFFSCREEN_READY_MESSAGE` from the offscreen bootstrap in [`offscreen.ts:16`](../../packages/extension/src/wallet/utils/offscreen.ts#L16)

This is strong MV3 defensive engineering.

### Keepalive during long PXE work

While an offscreen request is executing, the offscreen service sends `OFFSCREEN_KEEPALIVE` every 20 seconds in [`packages/extension/src/wallet/base/offscreen/service.ts:63`](../../packages/extension/src/wallet/base/offscreen/service.ts#L63).

That is specifically there to prevent Chrome from killing the service worker during long proof/simulation operations.

## Chain initialization model

`PxeService` owns a per-chain cache:

- `nodes: Map<chainId, AztecNode>`
- `pxes: Map<chainId, PXE>`
- `rpcs: Map<chainId, rpcUrl>`
- `chainInitPromises: Map<chainId, Promise<void>>`

See [`packages/extension/src/wallet/services/pxe/service.ts:67`](../../packages/extension/src/wallet/services/pxe/service.ts#L67) through [`pxe/service.ts:76`](../../packages/extension/src/wallet/services/pxe/service.ts#L76).

### Initialization path

On first use of a chain:

- `ensureChain(network)` de-duplicates concurrent initialization per `chainId` in [`pxe/service.ts:344`](../../packages/extension/src/wallet/services/pxe/service.ts#L344)
- `initChain(network)` creates:
  - `AztecNode` client against `network.rpcUrl`
  - PXE with `dataDirectory: pxe/${profileId}/${chainId}`
  - `proverEnabled: true`
  - `AcceleratorProver`
  in [`pxe/service.ts:397`](../../packages/extension/src/wallet/services/pxe/service.ts#L397)

The specific PXE configuration is:

- node created with `createAztecNodeClient(...)`
- PXE created with `createPXE(node, config, { proverOrOptions: prover })`

This means the wallet persists separate PXE IndexedDB state per `(profileId, chainId)`.

## What `PxeService` actually adds

`PxeService` is not just a dumb remote proxy over `createPXE`. It adds local policy and caching.

### 1. Contract instance resolution fallback

`getContractInstance()` tries, in order:

1. local PXE
2. node RPC
3. `knownInstances`

See [`pxe/service.ts:128`](../../packages/extension/src/wallet/services/pxe/service.ts#L128).

### 2. Contract artifact resolution fallback

`getContractArtifact()` tries, in order:

1. local PXE
2. `knownArtifacts`
3. external contract registry, if enabled

See [`pxe/service.ts:146`](../../packages/extension/src/wallet/services/pxe/service.ts#L146).

### 3. Known artifact bootstrap

`initKnown()` seeds a catalog of protocol and common application artifacts:

- auth registry
- class registry
- fee juice
- instance registry
- multi-call entrypoint
- public checks
- FPC / SponsoredFPC
- NFT / Token
- Wonderland token

See [`pxe/service.ts:317`](../../packages/extension/src/wallet/services/pxe/service.ts#L317).

It also seeds one deterministic known instance: SponsoredFPC at zero salt in [`pxe/service.ts:338`](../../packages/extension/src/wallet/services/pxe/service.ts#L338).

### 4. Optional public registry lookup

Artifact lookup against public registries is gated by `contractRegistry` config in [`pxe/service.ts:427`](../../packages/extension/src/wallet/services/pxe/service.ts#L427).

Currently only:

- testnet
- `v4-devnet-3`

have hardcoded registry URLs in [`pxe/service.ts:452`](../../packages/extension/src/wallet/services/pxe/service.ts#L452).

## Proof and simulation entry points

### Proof generation

`proveTx()` in offscreen is a thin wrapper over `pxe.proveTx(...)` after schema parsing in [`pxe/service.ts:221`](../../packages/extension/src/wallet/services/pxe/service.ts#L221).

The worker-side orchestration around it happens in `ExecutionService.proveTxTask()` in [`packages/extension/src/wallet/services/execution/service.ts:2147`](../../packages/extension/src/wallet/services/execution/service.ts#L2147).

### Simulation

`simulateTx()` in offscreen:

- parses overrides
- can inject stub account contracts for “kernelless” discovery simulation
- calls `pxe.simulateTx(...)`

See [`pxe/service.ts:236`](../../packages/extension/src/wallet/services/pxe/service.ts#L236).

That stub-account path is used by `ExecutionService.executeNoFromSendTx()` for default-entrypoint authwit discovery.

### Utility execution

`executeUtility()` just validates scopes/authwits and forwards to `pxe.executeUtility(...)` in [`pxe/service.ts:277`](../../packages/extension/src/wallet/services/pxe/service.ts#L277).

### Transaction profiling

`profileTx()` forwards to `pxe.profileTx(...)` in [`pxe/service.ts:286`](../../packages/extension/src/wallet/services/pxe/service.ts#L286).

## Sync model

### What the code does explicitly

The local code checks sync state only for debug logging:

- before proving in [`pxe/service.ts:223`](../../packages/extension/src/wallet/services/pxe/service.ts#L223)
- before simulation in [`pxe/service.ts:243`](../../packages/extension/src/wallet/services/pxe/service.ts#L243)

It reads:

- PXE anchor block via `pxe.getSyncedBlockHeader()`
- node tip via `node.getBlockNumber()`

### What the code does not do explicitly

I did **not** find any repo-local code that:

- starts a block stream explicitly
- waits for PXE to catch up before proving
- exposes PXE sync state as first-class application state

So the current design appears to rely on `createPXE(...)` to manage its own sync lifecycle internally.

That may be correct for the Aztec SDK, but from this repo alone the sync contract is implicit, not modeled.

## Concurrency model

`PxeService` wraps operations in a `ReadWriteGuard` in [`pxe/service.ts:71`](../../packages/extension/src/wallet/services/pxe/service.ts#L71).

### Current semantics

- reads run immediately with no real reader lock in [`packages/extension/src/wallet/utils/rw-guard.ts:25`](../../packages/extension/src/wallet/utils/rw-guard.ts#L25)
- writes are serialized under one lock in [`rw-guard.ts:34`](../../packages/extension/src/wallet/utils/rw-guard.ts#L34)
- profile switch/delete manually enter write mode in [`pxe/service.ts:463`](../../packages/extension/src/wallet/services/pxe/service.ts#L463) and [`pxe/service.ts:483`](../../packages/extension/src/wallet/services/pxe/service.ts#L483)

### Important caveat

The guard explicitly documents that it does **not** drain in-flight reads yet:

> “Phase 2 will add reader counting...” in [`rw-guard.ts:11`](../../packages/extension/src/wallet/utils/rw-guard.ts#L11)

So during a destructive write phase:

- reads can still race
- `read()` only logs that it is bypassing an active write in [`rw-guard.ts:27`](../../packages/extension/src/wallet/utils/rw-guard.ts#L27)

This is a real correctness gap, not just a TODO comment.

## Profile-switch and deletion behavior

### On active profile change

`PxeService` clears:

- `nodes`
- `pxes`
- `rpcs`
- `chainInitPromises`

in [`pxe/service.ts:483`](../../packages/extension/src/wallet/services/pxe/service.ts#L483).

It does **not** delete IndexedDB. It drops in-memory handles and lets the next call lazily recreate them.

### On profile deletion

`PxeService` additionally:

- clears known artifacts/instances
- deletes IndexedDB databases whose names start with `pxe/${profile.id}/`
- deletes `keyval-store`

in [`pxe/service.ts:463`](../../packages/extension/src/wallet/services/pxe/service.ts#L463).

### On offscreen service init

It also deletes orphan PXE DBs for profiles that no longer exist in [`pxe/service.ts:82`](../../packages/extension/src/wallet/services/pxe/service.ts#L82).

## Where the rest of the app depends on PXE behavior

The main worker-side clients of PXE are:

- `ExecutionService` for prove/simulate/send prep
- `TokenService` for contract/artifact discovery
- `AccountStateService` for debug account/sender/contract state
- `NoteService` for note reads
- `FpcService` for fee contract discovery
- `TransactionService` indirectly for receipt tracking, though it polls nodes rather than PXE

The heaviest dependence is from `ExecutionService`, especially:

- contract registration in [`packages/extension/src/wallet/services/execution/service.ts:1889`](../../packages/extension/src/wallet/services/execution/service.ts#L1889)
- tx request build in [`execution/service.ts:1862`](../../packages/extension/src/wallet/services/execution/service.ts#L1862)
- prove/send pipeline in [`execution/service.ts:624`](../../packages/extension/src/wallet/services/execution/service.ts#L624)
- default-entrypoint path in [`execution/service.ts:1267`](../../packages/extension/src/wallet/services/execution/service.ts#L1267)

## Risks and fragility

### 1. Sync is implicit, not first-class

The app does not model “PXE caught up to node tip” as explicit state before proof generation. It only logs the gap.

Risk: medium  
Size to improve: days

### 2. Read/write guard is incomplete

Profile deletion or switch can race with in-flight reads because reads are not blocked yet.

Risk: medium  
Size to improve: days

### 3. `PxeService` mixes process ownership with domain policy

It owns:

- offscreen PXE process state
- known artifact catalog
- registry lookup policy
- per-chain cache policy
- cleanup policy

That is too much responsibility for one service boundary.

Risk: medium  
Size to improve: days to weeks

### 4. Registry support is hardcoded and partial

Only two chain ids map to registry URLs. Artifact availability for other networks depends on PXE-local state or hardcoded known artifacts.

Risk: low to medium  
Size to improve: days

### 5. Offscreen supervision is repeated at the PXE client layer

The invariant “offscreen must be running” is enforced by `PxeServiceClient`, not by the generic offscreen transport.

Risk: low now, medium later if more offscreen services are added  
Size to improve: hours

## Concrete remediations

1. Add explicit PXE sync state and readiness gating.
Expose current anchor block, node tip, and “safe to prove” state to callers instead of only debug logging.
Risk: medium  
Size: days

2. Finish `ReadWriteGuard`.
Implement actual reader counting / draining so profile deletion and chain resets cannot race active reads.
Risk: medium  
Size: days

3. Split `PxeService` into smaller collaborators.
Suggested seams: chain runtime manager, artifact resolver, registry client, cleanup manager.
Risk: medium  
Size: weeks

4. Make artifact resolution policy explicit.
Today the order is local PXE → known artifacts → public registry. That should be documented and configurable as a strategy object, not buried in method bodies.
Risk: low  
Size: days

5. Add targeted tests around profile-switch/delete races.
Those are the highest-risk state transitions in the current PXE integration.
Risk: medium  
Size: days
