# Phase 0.3: Transaction Lifecycle Map

## Overview

Transactions enter the system through **two paths** (dApp-initiated and user-initiated) and converge at `ExecutionService` for a shared construction → proving → submission pipeline. A third flow covers the **dApp connection** handshake.

---

## Flow A: dApp-Initiated Transaction

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Page Script                                                  │
│    window.azguard.createClient().request("execute", params)     │
│    src/content-script/proxy/client.ts:46-65                     │
├─────────── ECDH encrypted postMessage ──────────────────────────┤
│ 2. Content Script (ProxyServer)                                 │
│    #onInpageMessage → service.invoke(method, payload)           │
│    src/content-script/proxy/server.ts:51-76                     │
├─────────── chrome.runtime.connect (port "rpc") ─────────────────┤
│ 3. RpcService.invoke("execute", params)                         │
│    → parseExecutionParams(params) → validate & parse            │
│    src/wallet/services/rpc/service.ts:38-60                     │
│    src/wallet/services/rpc/utils.ts:142-150                     │
├─────────────────────────────────────────────────────────────────┤
│ 4. DappInteractionService.execute(params)                       │
│    a) validateSession(params) → check perms                     │
│    b) isConfirmationNeeded(payload) → decide UI vs silent       │
│    src/wallet/services/dapp-interaction/service.ts:93-101       │
├──── IF confirmation needed ─────────────────────────────────────┤
│ 5a. interaction("execute", payload)                             │
│     → chrome.windows.create(popup /windows/execute)             │
│     → User approves/rejects                                     │
│     src/wallet/services/dapp-interaction/service.ts:103-144     │
├──── IF silent execution ────────────────────────────────────────┤
│ 5b. silentInteraction(payload)                                  │
│     → Direct execution without UI                               │
│     src/wallet/services/dapp-interaction/service.ts:147-223     │
├─────────────────────────────────────────────────────────────────┤
│ 6. ExecutionService.executeSendTransaction(op, origin, task)    │
│    a) buildAndEstimateTxRequest(op, feeMethod)                  │
│    b) Get account contract, resolve network, register contracts │
│    c) Build function calls, compute auth witnesses              │
│    d) Estimate gas, finalize fee settings                       │
│    src/wallet/services/execution/service.ts:469-496             │
├─────────── chrome.runtime.sendMessage (to offscreen) ───────────┤
│ 7. PXE.proveTx(txRequest)                                      │
│    → Private simulation + ZK proof generation                   │
│    src/wallet/services/execution/service.ts:1622-1633           │
├─────────── HTTPS JSON-RPC ──────────────────────────────────────┤
│ 8. AztecNode.sendTx(tx)                                        │
│    → Submit proved transaction to network                       │
│    src/wallet/services/execution/service.ts:1635-1646           │
├─────────────────────────────────────────────────────────────────┤
│ 9. TransactionService.addTransaction(...)                       │
│    → Record in local storage for history                        │
│    src/wallet/services/execution/service.ts:485-495             │
├─────────── Response path (reverse) ─────────────────────────────┤
│ 10. txHash → RpcService → ProxyServer → ProxyClient → dApp     │
└─────────────────────────────────────────────────────────────────┘
```

### Stage 4: Permission Validation (Critical Security Gate)

```typescript
// src/wallet/services/dapp-interaction/service.ts:225-280
validateSession(params: ExecutionParams) {
  1. Lookup session: dappSessionService.tryGetDappSession(sessionId)
  2. For each operation:
     - Check account permission: is account in session.accounts?
     - Check method permission: is method in session.permissions[].methods?
     - Check chain permission: is chain in session.permissions[].chains?
  3. Throw if any check fails
}
```

### Stage 4b: Confirmation Decision (Critical Security Gate)

```typescript
// src/wallet/services/dapp-interaction/service.ts:302-321
isConfirmationNeeded(payload: ExecutionPayload) → boolean {
  Returns TRUE (show UI) when:
    - Active profile != session profile (wallet locked)
    - Operation access level >= session confirmation level
    - Transaction without embedded fee payment

  Returns FALSE (silent execution) when:
    - Same profile active
    - All ops below confirmation threshold
    - All txs have embedded fees
}
```

**Access Level Hierarchy:**
| Level | Value | Operations |
|-------|-------|-----------|
| None | 0 | Confirm everything |
| PublicData | 1 | Public data queries |
| PxeState | 2 | PXE state access |
| AppState | 3 | Token registration, contract registration |
| PrivateData | 4 | Simulation, private events |
| Transactions | 5 | send_transaction, aztec_sendTx |

### Stage 6: Transaction Construction Detail

```
buildTxRequest(op, feePaymentMethod):
  1. Get active profile secret
  2. Get account contract (derives signing key from secret)
  3. Get Aztec node client
  4. Get PXE instance
  5. For each action in operation:
     - "call" → resolve contract, encode function call
     - "encoded_call" → use pre-encoded selector + args
     - "add_private_authwit" → compute hash, sign with account
     - "add_public_authwit" → compute hash, track in auth registry
     - "add_capsule" → create capsule object
     - "add_extra_args" → create hashed values
  6. Register all contracts in PXE
  7. Build TxExecutionRequest via account.buildTxExecutionRequest()
```

### Stage 6: Fee Payment Methods

| Method | Code | Description |
|--------|------|-------------|
| FeeJuice | `"fj"` | Direct fee payment in FeeJuice token |
| FeeJuice+Claim | `"fjwc"` | FeeJuice with claim action prepended |
| Fee Payment Contract | `"fpc"` | Sponsored fee via FPC contract |
| Embedded | `"embedded"` | Fee method embedded in dApp request |

### Findings

**[F-TA-01] HIGH - Silent Execution Path**
- File: `src/wallet/services/dapp-interaction/service.ts:97-98`
- dApps with sufficient `confirmationLevel` can execute transactions without any UI
- If a user grants `AccessLevel.Transactions` (5) as confirmation level, the dApp can send transactions silently
- **Recommendation:** Consider always requiring UI confirmation for `send_transaction`, regardless of confirmation level

**[F-TA-02] MEDIUM - No Transaction Amount/Recipient Display in Silent Path**
- File: `src/wallet/services/dapp-interaction/service.ts:147-223`
- Silent interactions bypass the confirmation popup entirely
- User never sees what the transaction does before it's submitted
- Depends entirely on the permission grant being intentional

**[F-TA-03] INFO - Transaction History Records Plaintext**
- File: `src/wallet/services/execution/service.ts:485-495`
- Transaction calls, amounts, recipients stored in `chrome.storage.local` unencrypted
- Provides forensic trail but also leaks user activity if storage is compromised

---

## Flow B: User-Initiated Send

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SendPopup.vue                                                │
│    User selects token, recipient, amount, fee settings          │
│    src/popup/components/popups/SendPopup.vue:233-278            │
├─────────── chrome.runtime.connect (port "execution") ───────────┤
│ 2. ExecutionServiceClient.executeTransfer(...)                  │
│    → networkId, accountAddress, tokenId, type,                  │
│      recipientAddress, amount, feeSettings                      │
│    src/wallet/services/execution/service.ts:152-279             │
├─────────────────────────────────────────────────────────────────┤
│ 3. ExecutionService.executeTransfer()                           │
│    a) Get active profile (auth check)                           │
│    b) Get token metadata                                        │
│    c) Determine transfer function (private/public/shield/etc.)  │
│    d) Encode function call                                      │
│    e) Build operation → same as dApp Stage 6                    │
│    src/wallet/services/execution/service.ts:152-279             │
├─────────────────────────────────────────────────────────────────┤
│ 4-7. Same as dApp flow stages 6-9                               │
│    buildAndEstimateTxRequest → proveTx → sendTx → record       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Differences from dApp Flow

| Aspect | dApp Flow | UI Flow |
|--------|-----------|---------|
| Entry point | `RpcService.invoke()` | `ExecutionService.executeTransfer()` |
| Origin type | `OriginType.DAPP` | `OriginType.UI` |
| Session validation | Required (permissions checked) | **None** (direct execution) |
| User confirmation | Conditional (isConfirmationNeeded) | **Already confirmed** (user clicked Send) |
| Parameter parsing | `parseExecutionParams()` + validation | Direct TypeScript parameters |
| Fee settings | Embedded or from session | From UI FeeSettings component |

### Transfer Types
```typescript
// Determined by selectedSendType + selectedReceiverType in SendPopup.vue
Private → Private:  TransferType.Private   (transfer_in_private)
Private → Public:   TransferType.Unshield  (unshield)
Public → Private:   TransferType.Shield    (shield)
Public → Public:    TransferType.Public    (transfer_in_public)
```

### Findings

**[F-TB-01] INFO - No Double-Confirmation for UI Sends**
- User clicks Send → transaction submitted immediately (after proof generation)
- No secondary "Are you sure?" confirmation
- This is standard wallet UX — the Send button IS the confirmation
- Fee estimation happens before user sees the Send button

---

## Flow C: dApp Connection

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Page Script                                                  │
│    window.azguard.createClient().request("connect", params)     │
│    params: { dappMetadata, requiredPermissions, optionalPerms } │
├─────────── Same proxy path as execute ──────────────────────────┤
│ 2. RpcService.invoke("connect", params)                         │
│    → parseConnectionParams(params)                              │
│    src/wallet/services/rpc/service.ts:50-52                     │
├─────────────────────────────────────────────────────────────────┤
│ 3. DappInteractionService.connect(params)                       │
│    → ALWAYS opens UI (no silent path for connections)           │
│    → interaction("connect", payload)                            │
│    src/wallet/services/dapp-interaction/service.ts:88-91        │
├─────────────────────────────────────────────────────────────────┤
│ 4. Connect Popup Window (/windows/connect)                      │
│    a) Display dApp metadata (name, logo, description)           │
│    b) Show required + optional permissions                      │
│    c) User selects accounts to share                            │
│    d) User selects confirmation policy                          │
│    e) User clicks Approve or Reject                             │
│    src/popup/windows/connect/index.vue                          │
├─────────── User approves ───────────────────────────────────────┤
│ 5. DappSessionService.addDappSession(...)                       │
│    → Generate session ID (64 hex chars, 256-bit)                │
│    → Create session with 7-day expiry                           │
│    → Store in chrome.storage.local                              │
│    src/wallet/services/dapp-session/service.ts:70-106           │
├─────────────────────────────────────────────────────────────────┤
│ 6. resolveInteraction(requestId, sessionInfo)                   │
│    → Returns { id, permissions, accounts } to dApp              │
│    → dApp stores session ID for future requests                 │
│    src/wallet/services/dapp-interaction/service.ts              │
└─────────────────────────────────────────────────────────────────┘
```

### Connection Always Requires UI
- Unlike `execute`, `connect` always calls `interaction()` (never `silentInteraction()`)
- User MUST approve every new connection
- This is the correct security design — connections grant ongoing permissions

### Permission Model
```typescript
DappPermissions {
  chains: string[]     // e.g., ["aztec:604129785"]
  methods: string[]    // e.g., ["send_transaction", "simulate_transaction"]
  events: string[]     // e.g., ["session_updated"]
}

// Session stores:
// - Required permissions (always granted if user approves)
// - Optional permissions (user can toggle individually)
// - Selected accounts (user picks which accounts to expose)
// - Confirmation level (how much the dApp can do silently)
```

### Confirmation Policies
From `src/utils/confirmation-policies.ts`:

| Policy | Level | Description |
|--------|-------|-------------|
| Confirm All | 0 | Every action requires popup |
| Auto Public Data | 1 | Public queries automatic |
| Auto PXE State | 2 | PXE queries automatic |
| Auto App State | 3 | Registration automatic |
| Auto Private Data | 4 | Simulations automatic |
| Auto Transactions | 5 | Everything automatic |

### Findings

**[F-TC-01] GOOD - Connect Always Requires UI**
- Connection flow cannot be silenced — every new dApp must go through the approval popup
- This prevents unauthorized dApp connections

**[F-TC-02] MEDIUM - Confirmation Level 5 Grants Full Silent Access**
- If user selects "Auto Transactions" (level 5), the dApp can silently send transactions
- The UI should clearly warn about the implications of high confirmation levels
- **Recommendation:** Add explicit warning text for level 4-5 confirmation policies

**[F-TC-03] LOW - 7-Day Session Expiry**
- Sessions last 7 days with no re-authentication requirement
- If a dApp is compromised during this window, it retains access
- **Recommendation:** Consider shorter default expiry or per-session configuration

---

## RPC Method Surface (Complete Enumeration)

| Method | Description | Access Level | Session Required |
|--------|-------------|-------------|-----------------|
| `get_wallet_info` | Wallet name, version, capabilities | None | No |
| `get_session` | Get session details by ID | None | Yes |
| `close_session` | Close/revoke a session | None | Yes |
| `connect` | Initiate dApp connection | None | No (creates session) |
| `execute` | Execute operation batch | Varies | Yes |

### Execute Operation Kinds

| Kind | Access Level | Description |
|------|-------------|-------------|
| `send_transaction` | Transactions (5) | Send signed transaction |
| `simulate_transaction` | PrivateData (4) | Simulate without sending |
| `get_complete_address` | PublicData (1) | Get account complete address |
| `register_contract` | AppState (3) | Register contract in PXE |
| `register_sender` | PxeState (2) | Register sender address |
| `register_token` | AppState (3) | Register token contract |
| `aztec_sendTx` | Transactions (5) | Send raw Aztec transaction |
| `aztec_simulateTx` | PrivateData (4) | Simulate raw transaction |
| `aztec_simulateUtility` | PrivateData (4) | Simulate utility function |
| `aztec_getPrivateEvents` | PrivateData (4) | Query private events |
| `aztec_profileTx` | PrivateData (4) | Profile transaction execution |

---

## Summary: Transaction Security Gates

```
dApp Request
  │
  ├── Gate 1: ECDH Encryption (content script boundary)
  │
  ├── Gate 2: RPC Method Validation (parseExecutionParams)
  │
  ├── Gate 3: Session Validation (validateSession)
  │   ├── Session exists and not expired?
  │   ├── Account authorized?
  │   ├── Method authorized?
  │   └── Chain authorized?
  │
  ├── Gate 4: Confirmation Decision (isConfirmationNeeded)
  │   ├── Profile match?
  │   ├── Access level vs confirmation level?
  │   └── Fee payment embedded?
  │
  ├── Gate 5: User Confirmation (popup window, if needed)
  │
  ├── Gate 6: Profile Authentication (getProfileSecret)
  │
  ├── Gate 7: PXE Proving (ZK proof generation)
  │
  └── Gate 8: Network Submission (Aztec node)
```

Each gate must pass for a transaction to succeed. Gates 3-5 are the primary authorization layer. Gate 6 ensures the wallet is unlocked. Gates 7-8 are cryptographic/network gates.
