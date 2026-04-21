# 06 Tx Pipeline

## Scope

This note traces how a send operation becomes a proven and submitted Aztec transaction in the extension today. It is based on the real popup send page, the background execution pipeline, task tracking, PXE calls, and transaction persistence.

I traced two concrete variants:

1. User-initiated token transfer from the popup send screen
2. Generic `send_transaction` / `aztec_sendTx` execution once an operation is already approved

The dApp approval and bridge mechanics are covered more fully in `07-dapp-bridge.md`, but the shared execution path is documented here because it converges inside `ExecutionService`.

## Flow summary

For the normal popup send flow, the sequence is:

1. Vue send screen gathers token, recipient, amount, and fee settings in [`packages/extension/src/popup/pages/send.vue:236`](../../packages/extension/src/popup/pages/send.vue#L236)
2. The popup calls `ExecutionServiceClient.executeTransfer(...)` over the background RPC port in [`packages/extension/src/wallet/services/execution/client.ts:22`](../../packages/extension/src/wallet/services/execution/client.ts#L22)
3. `ExecutionService.executeTransfer(...)` builds a `send_transaction`-style operation, estimates fees, proves with PXE, submits to the node, then persists a local transaction record in [`packages/extension/src/wallet/services/execution/service.ts:279`](../../packages/extension/src/wallet/services/execution/service.ts#L279)
4. `TransactionService.addTransaction(...)` stores the tx in `chrome.storage.local` and starts background polling of receipt status in [`packages/extension/src/wallet/services/transaction/service.ts:75`](../../packages/extension/src/wallet/services/transaction/service.ts#L75) and [`transaction/service.ts:128`](../../packages/extension/src/wallet/services/transaction/service.ts#L128)
5. The popup reconciles its optimistic placeholder when `onTransactionAdded` fires in [`packages/extension/src/stores/app.store.ts:133`](../../packages/extension/src/stores/app.store.ts#L133)

## Popup send flow

### UI responsibilities

The send screen is thin, but it does own a few workflow details:

- It computes the transfer arguments and calls `executeTransfer(...)` in [`send.vue:241`](../../packages/extension/src/popup/pages/send.vue#L241) through [`send.vue:270`](../../packages/extension/src/popup/pages/send.vue#L270).
- It pushes an optimistic placeholder into `appStore.awaitingTransactions` before the background has accepted or persisted anything in [`send.vue:257`](../../packages/extension/src/popup/pages/send.vue#L257).
- It navigates away after a fixed `700ms` delay, even though proving continues in the worker/offscreen runtime in [`send.vue:285`](../../packages/extension/src/popup/pages/send.vue#L285).
- It estimates fees by calling `estimateTransferFee(...)` on every debounced input change in [`send.vue:329`](../../packages/extension/src/popup/pages/send.vue#L329) through [`send.vue:377`](../../packages/extension/src/popup/pages/send.vue#L377).

The optimistic placeholder is removed later by heuristic matching in `appStore.onTxAdded(...)`, which compares account, contract, and destination derived from the first call in the persisted tx in [`app.store.ts:133`](../../packages/extension/src/stores/app.store.ts#L133) through [`app.store.ts:142`](../../packages/extension/src/stores/app.store.ts#L142).

That is a UI convenience layer, not a durable workflow primitive.

### Transfer operation construction

`ExecutionService.executeTransfer(...)` first converts the popup-level transfer intent into a generic operation:

- `buildTransferOperation(...)` resolves the token contract and function selector, then emits a single `encoded_call` action in [`execution/service.ts:257`](../../packages/extension/src/wallet/services/execution/service.ts#L257) through [`execution/service.ts:276`](../../packages/extension/src/wallet/services/execution/service.ts#L276).
- `executeTransfer(...)` wraps the whole flow in a root task and records origin as `UI` in [`execution/service.ts:290`](../../packages/extension/src/wallet/services/execution/service.ts#L290) through [`execution/service.ts:292`](../../packages/extension/src/wallet/services/execution/service.ts#L292).

This is an important architectural point: even the bespoke popup send screen is really a frontend for the generic operation engine.

## Background execution path

### 1. Fee estimation mutates the operation

`buildAndEstimateTxRequest(...)` is the first major stage in [`packages/extension/src/wallet/services/execution/service.ts:1718`](../../packages/extension/src/wallet/services/execution/service.ts#L1718).

It:

- starts an `"Estimating fee"` subtask in [`execution/service.ts:1728`](../../packages/extension/src/wallet/services/execution/service.ts#L1728)
- switches on `feeSettings.paymentMethod.kind` in [`execution/service.ts:1735`](../../packages/extension/src/wallet/services/execution/service.ts#L1735)
- may prepend fee-payment actions directly into `op.actions` with `unshift(...)` for `fjwc` and `fpc` in [`execution/service.ts:1755`](../../packages/extension/src/wallet/services/execution/service.ts#L1755), [`execution/service.ts:1793`](../../packages/extension/src/wallet/services/execution/service.ts#L1793), and [`execution/service.ts:1813`](../../packages/extension/src/wallet/services/execution/service.ts#L1813)
- simulates through PXE to size gas and finalize gas settings in [`execution/service.ts:1743`](../../packages/extension/src/wallet/services/execution/service.ts#L1743) through [`execution/service.ts:1849`](../../packages/extension/src/wallet/services/execution/service.ts#L1849)

The popup fee estimator already compensates for this mutability by cloning `op.actions` before estimating in [`execution/service.ts:373`](../../packages/extension/src/wallet/services/execution/service.ts#L373) through [`execution/service.ts:376`](../../packages/extension/src/wallet/services/execution/service.ts#L376). That comment exists because the function is not pure.

### 2. Transaction request assembly

`buildTxRequest(...)` is the real construction stage in [`execution/service.ts:1862`](../../packages/extension/src/wallet/services/execution/service.ts#L1862).

It pulls together:

- active profile, network, node, account contract, and PXE in [`execution/service.ts:1875`](../../packages/extension/src/wallet/services/execution/service.ts#L1875) through [`execution/service.ts:1883`](../../packages/extension/src/wallet/services/execution/service.ts#L1883)
- contract instances and artifacts for every referenced address in [`execution/service.ts:1885`](../../packages/extension/src/wallet/services/execution/service.ts#L1885) through [`execution/service.ts:1887`](../../packages/extension/src/wallet/services/execution/service.ts#L1887)
- lazy contract registration into PXE if a referenced contract is not already registered in [`execution/service.ts:1889`](../../packages/extension/src/wallet/services/execution/service.ts#L1889) through [`execution/service.ts:1897`](../../packages/extension/src/wallet/services/execution/service.ts#L1897)
- `capsules`, `authwits`, `extraHashedArgs`, and `FunctionCall[]` by iterating the action list in [`execution/service.ts:1900`](../../packages/extension/src/wallet/services/execution/service.ts#L1900) through [`execution/service.ts:2117`](../../packages/extension/src/wallet/services/execution/service.ts#L2117)
- a random nonce in [`execution/service.ts:1904`](../../packages/extension/src/wallet/services/execution/service.ts#L1904)
- the final `TxExecutionRequest` by calling `account.buildTxExecutionRequest(...)` in [`execution/service.ts:2119`](../../packages/extension/src/wallet/services/execution/service.ts#L2119) through [`execution/service.ts:2124`](../../packages/extension/src/wallet/services/execution/service.ts#L2124)

Two coupling details matter here:

1. Contract metadata hydration is mixed into tx assembly, so execution depends on registry state and artifact fetch behavior, not just the requested calls.
2. Public authwit actions also mutate the auth registry service as a side effect in [`execution/service.ts:1972`](../../packages/extension/src/wallet/services/execution/service.ts#L1972) through [`execution/service.ts:2004`](../../packages/extension/src/wallet/services/execution/service.ts#L2004).

### 3. Simulate, prove, submit

The last three stages are separate task-wrapped helpers:

- `simulateTxTask(...)` in [`execution/service.ts:2134`](../../packages/extension/src/wallet/services/execution/service.ts#L2134)
- `proveTxTask(...)` in [`execution/service.ts:2147`](../../packages/extension/src/wallet/services/execution/service.ts#L2147)
- `sendTxTask(...)` in [`execution/service.ts:2160`](../../packages/extension/src/wallet/services/execution/service.ts#L2160)

The actual popup transfer path is:

- estimate and assemble in [`execution/service.ts:305`](../../packages/extension/src/wallet/services/execution/service.ts#L305) through [`execution/service.ts:309`](../../packages/extension/src/wallet/services/execution/service.ts#L309)
- prove in [`execution/service.ts:311`](../../packages/extension/src/wallet/services/execution/service.ts#L311)
- materialize `Tx` and submit to the node in [`execution/service.ts:313`](../../packages/extension/src/wallet/services/execution/service.ts#L313) through [`execution/service.ts:314`](../../packages/extension/src/wallet/services/execution/service.ts#L314)

PXE is reached through a network-bound `PXEProxy` returned by `PxeServiceClient.getPXE(network)`, so `proveTx(...)` and `simulateTx(...)` are still remote calls into the offscreen runtime rather than in-process method calls in [`packages/extension/src/wallet/services/pxe/proxy.ts:34`](../../packages/extension/src/wallet/services/pxe/proxy.ts#L34) through [`proxy.ts:106`](../../packages/extension/src/wallet/services/pxe/proxy.ts#L106).

## Persistence and status lifecycle

Only after `node.sendTx(tx)` succeeds does the extension create a local transaction record:

- `TransactionService.addTransaction(...)` stores the tx under `nulo:core:txs` in [`packages/extension/src/wallet/services/transaction/service.ts:36`](../../packages/extension/src/wallet/services/transaction/service.ts#L36) and [`transaction/service.ts:75`](../../packages/extension/src/wallet/services/transaction/service.ts#L75)
- it emits `onTransactionAdded` and tracks the hash in the in-memory `pending` map in [`transaction/service.ts:104`](../../packages/extension/src/wallet/services/transaction/service.ts#L104) through [`transaction/service.ts:107`](../../packages/extension/src/wallet/services/transaction/service.ts#L107)
- the background worker polls receipts every second in [`transaction/service.ts:128`](../../packages/extension/src/wallet/services/transaction/service.ts#L128) through [`transaction/service.ts:145`](../../packages/extension/src/wallet/services/transaction/service.ts#L145)
- receipt deltas update `status`, `executionResult`, block info, fee, and error in [`transaction/service.ts:148`](../../packages/extension/src/wallet/services/transaction/service.ts#L148) through [`transaction/service.ts:177`](../../packages/extension/src/wallet/services/transaction/service.ts#L177)

So the durable boundary is later than the popup implies:

- before `sendTxTask(...)` completes, only the task tree exists
- after `sendTxTask(...)`, a tx hash is persisted and starts background polling

## Task model

Task tracking is entirely memory-resident:

- `TaskService` keeps everything in a `Map<string, Task>` in [`packages/extension/src/wallet/services/task/service.ts:31`](../../packages/extension/src/wallet/services/task/service.ts#L31)
- subtasks are nested by `WrappedTask.startSubtask(...)` in [`packages/extension/src/wallet/services/task/wrapped-task.ts:16`](../../packages/extension/src/wallet/services/task/wrapped-task.ts#L16)
- completed task trees are eventually dropped by retention cleanup in [`task/service.ts:218`](../../packages/extension/src/wallet/services/task/service.ts#L218) through [`task/service.ts:235`](../../packages/extension/src/wallet/services/task/service.ts#L235)
- switching profiles clears all tasks outright in [`task/service.ts:237`](../../packages/extension/src/wallet/services/task/service.ts#L237) through [`task/service.ts:245`](../../packages/extension/src/wallet/services/task/service.ts#L245)

That is fine for ephemeral progress UI, but it means proving/submission progress is not restart-resilient.

## Shared pipeline for dApp-originated sends

The generic execution path converges in the same place:

- `DappInteractionService.execute(...)` either runs silently or opens an approval window in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:117`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L117) through [`service.ts:125`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L125)
- approved operations are handed to `ExecutionService.executeOperations(...)` in [`dapp-interaction/service.ts:96`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L96) through [`service.ts:107`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L107)
- `send_transaction` goes through `executeSendTransaction(...)` in [`execution/service.ts:624`](../../packages/extension/src/wallet/services/execution/service.ts#L624)
- `aztec_sendTx` goes through `executeAztecSendTx(...)` in [`execution/service.ts:1200`](../../packages/extension/src/wallet/services/execution/service.ts#L1200) and eventually reaches the same estimate → prove → send sequence in [`execution/service.ts:1226`](../../packages/extension/src/wallet/services/execution/service.ts#L1226) through [`execution/service.ts:1247`](../../packages/extension/src/wallet/services/execution/service.ts#L1247)

So there are multiple front doors, but one large execution kernel.

## Architectural read

### What is working

- The pipeline is conceptually linear once inside `ExecutionService`: assemble, simulate, prove, send, persist.
- Fee estimation, proof generation, and submission are visible as explicit task stages.
- The popup send flow is largely a thin client over a background-owned execution engine.
- The durable tx record is separated from ephemeral progress state.

### Current pressure points

1. `ExecutionService` owns too many concerns.
It performs operation decoding, authwit derivation, contract registration, fee policy, tx assembly, proof orchestration, and submission in one class. The line span from [`execution/service.ts:279`](../../packages/extension/src/wallet/services/execution/service.ts#L279) through [`execution/service.ts:2169`](../../packages/extension/src/wallet/services/execution/service.ts#L2169) is the clearest God-object in the tx path.

2. Fee estimation is not pure.
`buildAndEstimateTxRequest(...)` mutates `op.actions` in place. The caller-side cloning in `estimateTransferFee(...)` proves the team already knows this is dangerous.

3. The popup uses heuristic optimistic reconciliation.
`awaitingTransactions` is matched by account + contract + destination, not by a durable request ID or operation ID in [`app.store.ts:133`](../../packages/extension/src/stores/app.store.ts#L133). Two same-destination sends can collide.

4. Contract hydration is hidden inside tx building.
`buildTxRequest(...)` can fetch instances/artifacts and register contracts as a side effect before assembling calls in [`execution/service.ts:1885`](../../packages/extension/src/wallet/services/execution/service.ts#L1885) through [`execution/service.ts:1897`](../../packages/extension/src/wallet/services/execution/service.ts#L1897). That makes execution behavior depend on mutable PXE registry state.

5. Task progress is not durable.
If the worker is suspended during proving or submission, the in-memory task graph is lost even though the user already left the form.

6. Transaction persistence happens late.
Nothing is stored until after `node.sendTx(tx)` succeeds. There is no durable representation of “proof in progress” or “submission in progress”.

## Recommendations flowing from this concern

1. Extract a pure `TxPlanBuilder`.
Risk: medium. Size: days.
Inputs should be operation + fee settings + resolved dependencies; outputs should be an immutable tx plan describing calls, authwits, gas policy, and required PXE registrations.

2. Split execution into explicit stages with stable interfaces.
Risk: medium. Size: days to weeks.
Create modules such as `operation-normalizer`, `fee-estimator`, `tx-request-builder`, `tx-prover`, and `tx-submitter`. `ExecutionService` should orchestrate them, not implement them.

3. Introduce a durable operation/request ID from UI to persistence.
Risk: low. Size: hours to days.
Have the popup generate a client request ID, send it through the RPC call, and persist it with the tx record so optimistic UI can reconcile deterministically.

4. Persist workflow state before proving.
Risk: medium. Size: days.
Add a lightweight `pending_operations` store or extend `TransactionService` so the user-visible lifecycle can survive worker restarts before the tx hash exists.

5. Move PXE contract registration out of the tx builder.
Risk: medium. Size: days.
Introduce a `ContractRegistryResolver` that precomputes and applies registration requirements, so tx assembly becomes easier to unit test.

6. Make fee estimation side-effect free.
Risk: low. Size: hours.
Clone or return a new action list inside `buildAndEstimateTxRequest(...)` rather than mutating caller state.

7. Persist or replay task trees from operation state.
Risk: medium. Size: days.
Even a coarse-grained persisted stage enum would be better than today’s fully ephemeral task graph.
