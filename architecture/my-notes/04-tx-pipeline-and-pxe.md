# Transaction Pipeline & PXE Integration

_Read date: 2026-04-20. Salvaged from Explore agent output._

## 1. User-Initiated Send (end-to-end)

### 1.1 Popup entry
**`src/popup/pages/send.vue`** line 562 "Confirm Transaction" → `handleSend()` (lines 236-297).
- Snaps reactive refs, appends to `appStore.awaitingTransactions`
- `executionService.executeTransfer(networkId, accountAddress, tokenId, transferType, recipientAddress, amount, feeSettings)` — returns Promise<string> (tx hash)
- On resolve: toast + navigate. On reject: toast, stay on form, allow retry.

### 1.2 SW service entry
**`src/wallet/services/execution/service.ts::executeTransfer`** (lines 279-349). Pipeline:

```
transferTask = taskService.startNewTask(TransferContent(...), undefined, origin)
  └─ buildTransferOperation()   → SendTransactionOperation
  └─ buildAndEstimateTxRequest(op, feeSettings, transferTask)
       └─ [txRequest, node, pxe, account, network, nonce, calls, feePaymentMethod]
  └─ proveTxTask(pxe, txRequest, scopes, transferTask)   → TxProvingResult
  └─ provedTx.toTx()
  └─ sendTxTask(node, tx, transferTask)
  └─ transactionService.addTransaction(...)   → persist + emit
  └─ transferTask.complete()
```

### 1.3 `buildAndEstimateTxRequest` (lines 1718-1860)

Starts subtask "Estimating fee". Switches on `feeSettings.paymentMethod.kind`:

- **`"fj"`** (FeeJuice, lines 1736-1751): buildTxRequest → suggestGasLimits → simulateTxTask → finalizeGasLimits
- **`"fjwc"`** (FeeJuice w/ claim): prepends claim payload, same flow
- **`"fpc"`** (lines 1772-1816): **two-pass estimation**
  1. Baseline: build+simulate without FPC payload, get `gasUsed`
  2. Fetch `node.getCurrentMinFees().mul(multiplier)` → `baseFees`
  3. `maxFee = gasUsed.totalGas + fpc.getTotalGas(inPublic)` × baseFees
  4. Prepend FPC payload: `op.actions.unshift(...fpc.getFeePayload(acct, maxFee, inPublic))`
  5. Re-build + re-simulate with FPC
- **`"embedded"`** (lines 1818-1850): dApp-specified fee, 1× multiplier

### 1.4 `buildTxRequest` → PXE account entrypoint (lines 1862-2100+)

1. Get context: `accountService.getAccountContract()` (returns `IAccountContract`), `networkService.getNode()`, `pxeService.getPXE()`, `node.getNodeInfo()`
2. Register contracts in PXE (cascade: PXE → node → known)
3. Process actions (`encoded_call`, `add_capsule`, `add_extra_args`, `add_private_authwit`, `add_public_authwit`)
4. Build ExecutionPayload, generate **random nonce** `Fr.random()` (line 1904). **No per-account mutex.** Replay protection via `TxContext.txNonce`.
5. `account.buildTxExecutionRequest(node, pxe, payload, options)`

### 1.5 NuloAccount adapter (nulo-account.ts:102-138)

```ts
async buildTxExecutionRequest(node, pxe, payload, options) {
  const { l1ChainId, rollupVersion } = await node.getNodeInfo()
  let current = payload
  while (current.calls.length > APP_MAX_CALLS) {
    current = await this.chunkHead(current, chainInfo)   // recursive wrapping
  }
  await this.ensureRegistered(pxe)
  await this.ensureContractRegistered(pxe)

  const initNullifier = await computeSiloedPrivateInitializationNullifier(...)
  const initWitness = await node.getNullifierMembershipWitness("latest", initNullifier)

  if (!initWitness) return this.buildWithInitialization(...)   // deploy + exec via multi-call entrypoint
  return this.entrypoint.createTxExecutionRequest(current, gasSettings, chainInfo, options)
}
```

Delegates cryptography to upstream `DefaultAccountEntrypoint` / `DefaultMultiCallEntrypoint`.

### 1.6 Proof generation

**Execution layer:** `execution/service.ts::proveTxTask` (lines 2147-2158) — wraps `pxe.proveTx(txRequest, scopes)` in a "Generating proof" subtask.

**PXE client:** `pxe/client.ts::proveTx` (lines 117-121) — `ensureOffscreenRunning()` → RPC `request("proveTx", network, txRequest, scopes)` → `TxProvingResult.schema.parseAsync(result)`.

**PXE service (offscreen):** `pxe/service.ts::proveTx` — `this.withPxeWrite("proveTx", network, async pxe => pxe.proveTx(txRequest, scopes))`. Acquires write lock; delegates to upstream Aztec.js PXE.

Returns `TxProvingResult { publicInputs, proof, errors[] }`.

### 1.7 Submission

`execution/service.ts::sendTxTask` (lines 2160-2168) — wraps `node.sendTx(tx)` in a "Sending transaction" subtask. Returns once mempool accepts. Confirmation is **async**, polled separately.

## 2. dApp-Initiated Flow

### 2.1 Content script relay
**`src/content-script/content.ts`** — uses standard `@aztec/wallet-sdk`'s `ContentScriptConnectionHandler`. Pure relay via `chrome.runtime.sendMessage`. No private keys in content script. Encrypted tunnel (ECDH + AES-256-GCM) owned by the SDK.

### 2.2 SW-side interaction orchestration
**`src/wallet/services/dapp-interaction/service.ts::execute`** (lines 117-196):
- Validates session
- `isConfirmationNeeded()` — if false, `silentInteraction()` (auto-approves low-risk)
- Otherwise `interaction(...)`: creates Promise, stores callback keyed by random id, opens popup window via `chrome.windows.create({ url: .../execute?requestId=<id> })`. Blocks until user approves/rejects.

### 2.3 Execute window
**`src/popup/windows/execute/index.vue`** (lines 108-246):
- Reads `requestId` from query, fetches payload via `getInteractionPayload()`
- Parses operations (`send_transaction`, `aztec_sendTx`, others)
- On approve (lines 260-278): validates fee settings, `interactionService.approveInteraction(requestId, operations, origin)`, closes window

### 2.4 Approval routing
**DappInteractionService.approveInteraction** → `executeAndResolve` → `profileService.refreshSession()` → `executionService.executeOperations(operations, origin)`.

**ExecutionService.executeOperations** (execution/service.ts:440-553) — iterates `operations`, stops on first failure, dispatches on `operation.kind` (15+ kinds). For `send_transaction` / `aztec_sendTx`, routes to same proof pipeline as UI send.

## 3. PXE Offscreen Lifecycle

**File:** `src/offscreen/index.ts`

- Responds to `OFFSCREEN_PING` with `OFFSCREEN_PONG`
- Global `self.onunhandledrejection` → logger (swallows failures if SW dead)
- `services.add(new PxeService())`; `services.start()`; sends `OFFSCREEN_READY_MESSAGE`

**Under MV3:** no explicit offscreen lifetime guarantee. Strategy:
- SW stays alive via heartbeat + operations
- Offscreen created on demand (first `getPXE(network)` call)
- SW pings offscreen; recreates if PONG missing
- Request-side `OFFSCREEN_KEEPALIVE` every 20s during long ops (90s timeout vs. popup's 10s)

**Per-chain PXE cache:** `pxe/service.ts` (lines 62-121)
- `pxes: Map<chainId, PXE>`, `nodes: Map<chainId, AztecNode>`, `rpcs: Map<chainId, string>`
- `chainInitPromises` — dedupe concurrent inits
- `knownArtifacts` / `knownInstances` — hardcoded protocol contracts fallback

**Cascade lookup** for contracts: PXE (user-registered) → Node (on-chain) → Known (hardcoded).

## 4. Task Service — Progress Event Tree

**Spec:** `src/wallet/services/task/spec.ts`

```ts
enum ContentKind { Step, BalanceUpdate, TokenMint, ExecuteOperation, Transfer, RevokeAuthwits }
enum TaskStatus { Pending, Processing, Completed, Cancelled, Failed }
```

**Tree shape:**
```
TransferContent (root)
├─ StepContent("Estimating fee")
├─ StepContent("Generating proof")
└─ StepContent("Sending transaction")
```

**Events:** `onTaskCreated`, `onTaskUpdated`, `onTaskDeleted` (60-min TTL).

UI subscribes in `TransactionAwaitingCard.vue` + `RecentActivityView.vue`.

## 5. Concurrency

**No per-account mutex.** Nonce is `Fr.random()`. Multiple concurrent proofs can run; Aztec node dedups via `TxContext.txNonce`.

**PXE-level:** `ReadWriteGuard` (`pxe/service.ts:71`). ⚠️ Codex flag: reads may not actually block during destructive writes.

**DappInteractionService-level:** `Lock` (service.ts:41). Used to make storage record creation atomic.

## 6. Fee + FPC

**Config:** `FeeSettings.paymentMethod` union of `"fj" | "fjwc" | "fpc" | "embedded"`.

**FPC types** (`fpc/service.ts`):
- `DefaultFpc` — user-configured
- `DefaultSponsoredFpc` — protocol's SponsoredFPC (standard salt=0)
- `PrivateFpc` — protocol's PrivateFPC (private fee path)

Auto-discovery: `getFpcs()` registers missing protocol FPCs in PXE, detects types, computes `acceptsPrivate`/`acceptsPublic`.

**Two-pass estimation for FPC** as described in §1.3.

## 7. Error paths

1. **Simulation failure** (PXE assertion / invalid proof) → exception up through `executeTransfer` → caught in `send.vue` → toast, preserve form
2. **Proof generation failure** → subtask `task.fail(error)` → re-throw → parent task fails → UI renders error
3. **Node rejection** → `node.sendTx` throws → same path
4. **Post-submission status** (node acceptance doesn't mean settlement) → `transaction/service.ts::runWorker` polls every 1s (lines 128-165): queries `node.getTxReceipt(tx.hash)` for each pending, updates status (Pending → Settled/Proven/Failed/Dropped), emits `onTransactionUpdated`

## 8. Message-flow summary diagram

```
POPUP (send.vue)
  ExecutionServiceClient.executeTransfer()
              │ port RPC
              ▼
SW (ExecutionService.executeTransfer)
  ├─ TaskService events (Pending → Processing)
  ├─ PxeServiceClient.simulateTx()   ─┐
  ├─ PxeServiceClient.proveTx()      │  stateless sendMessage
  └─ AztecNode.sendTx()              │  90s timeout, 20s keepalive
                                     ▼
                    OFFSCREEN (PxeService)
                      withPxeWrite / withPxeRead
                        upstream @aztec/pxe

Background polling:
SW (TransactionService.runWorker)  every 1s
  └─ node.getTxReceipt(hash) for each pending
     └─ onTransactionUpdated → UI refresh
```

## 9. Key properties

- Proofs generated off-thread (offscreen) — UI never blocks
- Random nonce, no per-account queue — risk is bounded by protocol-level replay protection
- Two-pass FPC estimation is correct but expensive (double-simulation cost)
- Error surface is deep but generally propagates upward cleanly
- Progress tracking via TaskService tree is powerful but adds coupling (many consumers subscribe)
