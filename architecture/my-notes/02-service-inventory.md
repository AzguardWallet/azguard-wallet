# Nulo Wallet Extension: Complete Service Inventory

**Date:** April 20, 2026  
**Scope:** `/packages/extension/src/wallet/services/`  
**Services:** 22 core services + 1 integration layer (wallet-sdk)

---

## Service Registry

### 1. **AccountService** ← God Service
**Path:** `/account/`  
**Responsibility:** Manages on-chain account contracts (Schnorr accounts) and key derivation per profile/chain.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getAccounts(profileId, chainId, all?)` → Account[]<br>`getAccount(profileId, chainId, address)` → Account \| undefined<br>`createAccount(profileId, chainId, type, name)` → Account<br>`changeAccountName(...)` → Account \| undefined<br>`changeAccountVisibility(...)` → Account \| undefined<br>`getAccountContract(...)` → IAccountContract |
| **Events** | `onAccountAdded: Account`<br>`onAccountUpdated: Account`<br>`onAccountDeleted: Account` |
| **Storage** | `nulo:core:accounts` (EntityStorage, Local) |
| **Dependencies** | ProfileService (direct import at /service.ts:6) |
| **PXE/External** | None; derivation is pure crypto |
| **Aztec Deps** | @aztec/foundation/crypto/poseidon (key derivation), @aztec/foundation/curves/bn254 (Fr type) |
| **Testability** | **Needs mocks:** ProfileService for secret derivation |

### 2. **AccountStateService**
**Path:** `/account-state/`  
**Responsibility:** Syncs registered senders/accounts/contracts from PXE with UI state; manages offchain account registration.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getAccounts(networkId)` → string[]<br>`getSenders(networkId)` → string[]<br>`addSender(networkId, address)` → string (fires event)<br>`deleteSender(networkId, address)` → string (fires event)<br>`getContracts(networkId)` → string[] |
| **Events** | `onSenderAdded: string`<br>`onSenderDeleted: string` |
| **Storage** | None (read-only from PXE) |
| **Dependencies** | PxeServiceClient (new instance), NetworkService (direct) |
| **PXE/External** | **Heavy PXE user:** `.getRegisteredAccounts()`, `.getSenders()`, `.registerSender()`, `.removeSender()`, `.getContracts()`, `.getContractInstance()`, `.getContractArtifact()` |
| **Aztec Deps** | AztecAddress parsing, stdlib types |
| **Testability** | **Requires PXE/node:** All methods hit PXE. Essentially un-unit-testable as written. |

### 3. **AuthRegistryService** ← God Service
**Path:** `/auth-registry/`  
**Responsibility:** Tracks public authwits (transaction authorizations), manages auth registry state per account, syncs revocation status.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getAuthwits(account)` → Authwit[]<br>`revokeAuthwits(networkId, account, ids[], feeSettings)` → void (sends tx)<br>`getRegistryEnabled(account)` → boolean<br>`setRegistryEnabled(networkId, account, enabled, feeSettings)` → void (sends tx)<br>`syncRegistry(networkId, account)` → void |
| **Events** | `onAuthwitAdded: Authwit`<br>`onAuthwitDeleted: Authwit`<br>`onRegistryEnabled: string`<br>`onRegistryDisabled: string` |
| **Storage** | `nulo:core:auth-registry` (EntityStorage, Local)<br>`nulo:core:auth-registry-enabled` (EntityStorage, Local) |
| **Dependencies** | ExecutionService, ProfileService, NetworkService, AccountService, TaskService, TransactionService (all direct imports at /service.ts:4-10) |
| **PXE/External** | Via ExecutionService (indirect); utility function `isAuthRegistryEnabled()` reads contract state; `isAuthwitConsumable()` checks consumability |
| **Aztec Deps** | Auth registry contract ABI, authwit hashing |
| **Testability** | **Essentially un-unit-testable:** Tight coupling to ExecutionService + TransactionService. Must mock both fully. Heavy use of Lock for concurrency testing. |
| **Pattern Break** | Direct imports of ExecutionService, TransactionService, TaskService—bypasses RPC abstraction. Shared Lock instance prevents easy mocking. |

### 4. **ConfigService**
**Path:** `/config/`  
**Responsibility:** Proxies config store; emits updates when config properties change.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getProps()` → ConfigProp[]<br>`getValue<TKey>(key)` → Config[TKey]<br>`setValue<TKey>(key, value)` → void<br>`reset()` → void |
| **Events** | `onUpdate: ConfigProp` |
| **Storage** | Delegates to injected IConfigStore (not stored as Entity/Value) |
| **Dependencies** | IConfigStore (injected in constructor) |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Trivially unit-testable:** Pure proxy over injected store. No service dependencies. |

### 5. **ContactService**
**Path:** `/contact/`  
**Responsibility:** Stores and manages user-saved contact addresses (with colors, abbreviations, import/export).

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getContacts()` → Contact[]<br>`getContact(id)` → Contact<br>`getContactByAddress(address)` → Contact \| undefined<br>`addContact(name, address, color?)` → Contact<br>`updateContact(id, name?, address?)` → Contact<br>`deleteContact(id)` → Contact<br>`exportContacts()` → string (JSON)<br>`importContacts(data)` → Contact[] |
| **Events** | `onContactAdded: Contact`<br>`onContactUpdated: Contact`<br>`onContactDeleted: Contact` |
| **Storage** | `nulo:core:contacts` (EntityStorage, Local) |
| **Dependencies** | ProfileService (direct) |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Trivially unit-testable:** Only depends on ProfileService for active profile. No PXE. No crypto. Lock-based concurrency is testable with proper setup. |

### 6. **DappInteractionService** ← God Service
**Path:** `/dapp-interaction/`  
**Responsibility:** Queues dApp interaction requests (operations, capabilities, discovery) and routes them through popup windows for user approval; mediates between SDK and UI.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getInteractionPayload(id)` → ExecutionPayload \| CapabilityPayload \| DiscoveryPayload<br>`approveInteraction(id, operations[], origin)` → void (executes ops)<br>`resolveInteraction(id, result)` → void<br>`rejectInteraction(id, reason)` → void<br>`execute(params, cancellationToken?)` → ExecutionResult (public, non-RPC)<br>`requestCapabilities(params, cancellationToken?)` → CapabilityResult (public)<br>`discover(params, cancellationToken?)` → DiscoveryResult (public)<br>`cancelInteraction(token)` → void (public) |
| **Events** | `onInteractionCancelled: string` |
| **Storage** | In-memory Map (not persisted) |
| **Dependencies** | ProfileService, NetworkService, AccountService, DappSessionService, ExecutionService (all direct) |
| **PXE/External** | Via ExecutionService (heavy user of Execution operations) |
| **Aztec Deps** | CAIP chain/account notation parsing, Operation types, AuthorizationRequest types |
| **Testability** | **Essentially un-unit-testable:** Launches Chrome windows, tight ExecutionService coupling, complex permission validation logic (checkMethodPermission, checkAccountPermission, checkScopesPermissions at /service.ts:333-358). |
| **Pattern Break** | Chrome API calls embedded directly (line 173-193). Direct execution path bypasses normal operation flow. |

### 7. **DappSessionService**
**Path:** `/dapp-session/`  
**Responsibility:** Manages dApp sessions: permissions, accounts, expiry, capability grants/rejections, verification hashes.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getDappSessions()` → DappSession[]<br>`getDappSession(sessionId)` → DappSession<br>`tryGetDappSession(sessionId)` → DappSession \| undefined<br>`tryGetDappSessionByOrigin(origin)` → DappSession \| undefined<br>`addDappSession(metadata, permissions[], accounts[], confirmationLevel)` → DappSession<br>`updateDappSession(sessionId, permissions[], accounts[], confirmationLevel)` → DappSession<br>`upgradeDappSession(sessionId, newSessionId, newExpiry)` → DappSession (internal)<br>+ setters for `setVerificationHash`, `setTrustedVerification`, `setAccountAliases`, `setCapabilityGrants`, `setCapabilityRejections` |
| **Events** | `onDappSessionAdded: DappSession`<br>`onDappSessionUpdated: DappSession`<br>`onDappSessionDeleted: DappSession` |
| **Storage** | `nulo:core:dappSessions` (EntityStorage, Local); auto-deletes expired sessions |
| **Dependencies** | ProfileService (direct) |
| **PXE/External** | None |
| **Aztec Deps** | AccessLevel enum for confirmation thresholds |
| **Testability** | **Needs mocks:** ProfileService for profile existence. Expiry logic and Lock concurrency testable with time mocks. |

### 8. **ExecutionService** ← God Service (Most Complex)
**Path:** `/execution/`  
**Responsibility:** Orchestrates transaction execution: simulates operations, builds TxExecutionRequest, routes through FPC, tracks authwits, manages fees, handles both Nulo and aztec.js operation kinds.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `executeTransfer(networkId, accountAddress, tokenId, transferType, recipientAddress, amount, feeSettings)` → string (txHash)<br>`executeOperations(operations[], origin)` → OperationResult[]<br>`getGasBalances(networkId, accountAddress, forceRefresh?)` → GasBalances<br>`estimateTransferFee(...)` → TransferFeeEstimate<br>`estimateOperationFee(operation, feeSettings)` → TransferFeeEstimate<br>+ internal `executeSendTransaction()` (non-RPC, called by AuthRegistry/DappInteraction) |
| **Events** | None declared; fires through TaskService |
| **Storage** | In-memory cache for gas balances (5-min TTL) |
| **Dependencies** | NetworkService, PxeServiceClient (new), AccountService, ContactService, ProfileService, AuthRegistryService, TokenService, FpcService, TaskService, TransactionService (imports at /service.ts:42-65) |
| **PXE/External** | **Extremely heavy PXE user:** `.proveTx()`, `.simulateTx()`, `.executeUtility()`, `.getContractInstance()`, `.getContractArtifact()`, `.registerAccount()`, `.registerSender()`, `.registerContract()`, `.getChainInfo()` |
| **Aztec Deps** | @aztec/aztec.js (wallet, authorization, contracts), @aztec/stdlib (abi, tx execution, gas, auth), @aztec/pxe (simulation options), @aztec/noir-contracts.js (FPC artifacts) |
| **Testability** | **Essentially un-unit-testable as written:** Tight coupling to 10+ services. Direct AuthRegistryService integration at line 48. Heavy PXE simulation. Concrete NuloFeePaymentMethod instantiation. Over 600 lines of complex orchestration logic. |
| **Pattern Break** | Direct imports of AuthRegistryService, FpcService, Token*Service, bypassing RPC. No client-side abstraction for PxeServiceClient (must run offscreen). |

### 9. **FpcService** ← Important (Fee Payment)
**Path:** `/fpc/`  
**Responsibility:** Discovers and manages FPC (Fee Payment Contract) instances; auto-discovers protocol FPCs (SponsoredFPC, PrivateFPC); handles FPC artifact loading and validation.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getFpcs(chainId?)` → FpcInfo[]<br>`getFpc(id)` → FpcInfo<br>`addFpc(networkId, type, address, name?)` → FpcInfo<br>`updateFpc(id, name)` → FpcInfo<br>`deleteFpc(id)` → FpcInfo<br>`getFpcImpl(id)` → Fpc (internal, used by ExecutionService) |
| **Events** | `onFpcAdded: FpcInfo`<br>`onFpcUpdated: FpcInfo`<br>`onFpcDeleted: FpcInfo` |
| **Storage** | `nulo:core:fpcs` (EntityStorage, Local) |
| **Dependencies** | ProfileService, NetworkService, PxeServiceClient (new) |
| **PXE/External** | `.registerContract()`, `.getContractInstance()`, `.getContractArtifact()`; calls node via `getFpcHandler(type).getAsset(...)` |
| **Aztec Deps** | SponsoredFPCContractArtifact, PrivateFPCContractArtifact (imported via JSON), @aztec/stdlib contract utilities |
| **Testability** | **Requires PXE/node:** FPC discovery and artifact loading hit PXE. Type detection logic (line 274-291) is testable. |

### 10. **LogViewerService**
**Path:** `/log-viewer/`  
**Responsibility:** Exposes logger store to UI; streams logs in real-time via events.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getLogs(count, fromId?)` → Log[]<br>`clearLogs()` → void |
| **Events** | `onLog: Log` |
| **Storage** | Delegates to ILoggerStore (passed in constructor) |
| **Dependencies** | ILoggerStore (injected) |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Trivially unit-testable:** Pure proxy over logger. No service coupling. |

### 11. **LoggerService**
**Path:** `/logger/`  
**Responsibility:** Central logging proxy; routes context/source/level/data to app logger.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `log(context, source, level, ...data)` → void |
| **Events** | None |
| **Storage** | None |
| **Dependencies** | LoggerStore (injected in constructor) |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Trivially unit-testable:** Direct delegation. No RPC. No external calls. |

### 12. **NetworkService** ← Critical Infrastructure
**Path:** `/network/`  
**Responsibility:** Manages network (RPC) configuration per profile/chain; caches AztecNode instances; seeds default networks (Alpha Mainnet, Testnet, Devnet, Local).

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getOrInitNetworks()` → Network[] (seeds defaults if empty)<br>`getNetworks(chainId?)` → Network[]<br>`getNetwork(id)` → Network<br>`addNetwork(name, rpcUrl)` → Network<br>`updateNetwork(id, name, rpcUrl)` → Network<br>`deleteNetwork(id)` → Network<br>`setDefault(id)` → Network<br>`getNodeStatus(id)` → NodeStatus<br>`getNode(chainId)` → AztecNode (internal) |
| **Events** | `onNetworkAdded: Network`<br>`onNetworkUpdated: Network`<br>`onNetworkDeleted: Network`<br>`onDefaultNetworkChanged: Network` |
| **Storage** | `nulo:core:networks` (EntityStorage, Local) |
| **Dependencies** | ProfileService (direct) |
| **PXE/External** | Creates AztecNode clients via `createAztecNodeClient(rpcUrl, ...)`; validates node status via RPC fetch |
| **Aztec Deps** | @aztec/stdlib/interfaces/client (AztecNode), makeFetchWithTimeout utility |
| **Testability** | **Needs mocks:** ProfileService, RPC endpoint. AztecNode instantiation is network-dependent. |

### 13. **NoteService**
**Path:** `/note/`  
**Responsibility:** Fetches and parses private notes from PXE for a given account and optional contract filter.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getNotes(networkId, account, contract?)` → Note[] (parsed with guessed types) |
| **Events** | None |
| **Storage** | None |
| **Dependencies** | NetworkService, PxeServiceClient (new) |
| **PXE/External** | Heavy: `.getContracts()` (to enumerate), `.getNotes(filter)` with NoteStatus.ACTIVE |
| **Aztec Deps** | NoteDao, NoteStatus, AztecAddress |
| **Testability** | **Requires PXE/node:** All note parsing is PXE-dependent. |

### 14. **PasskeyService**
**Path:** `/passkey/`  
**Responsibility:** Manages WebAuthn passkey creation and retrieval; creates popup windows for passkey interaction.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `createKey(userHandle)` → PasskeyCredential (opens popup, waits)<br>`getKey(credentialId?)` → PasskeyCredential (opens popup, waits)<br>`getPendingRequest(requestId)` → PasskeyRequest<br>`resolvePasskeyRequest(requestId, result)` → void<br>`rejectPasskeyRequest(requestId, reason)` → void |
| **Events** | None |
| **Storage** | In-memory pending request Map |
| **Dependencies** | None |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Essentially un-unit-testable:** Chrome window creation, WebAuthn browser API, async popup wait. |
| **Pattern Break** | Direct chrome.windows.create calls (line 59-86). |

### 15. **ProfileService** ← Critical (Session + Master Secret)
**Path:** `/profile/`  
**Responsibility:** Manages profiles (password/passkey-backed); handles master secret derivation/encryption; controls session TTL and active profile state.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getActiveProfile()` → ProfileInfo \| undefined<br>`getProfiles()` → ProfileInfo[]<br>`createProfile(name, password)` → ProfileInfo<br>`createPasskeyProfile(name)` → ProfileInfo<br>`unlockProfile(id, password)` → ProfileInfo<br>`unlockPasskeyProfile(id)` → ProfileInfo<br>`lockActiveProfile()` → void<br>`refreshSession()` → void<br>`changeProfileName(id, newName)` → ProfileInfo<br>`changeProfilePassword(id, oldPassword, newPassword)` → ProfileInfo<br>`confirmProfileOperation(id, password?)` → boolean<br>`deleteProfile(id)` → ProfileInfo<br>`importEncrypted(name, secret, password)` → ProfileInfo<br>`importPlain(name, secret, password)` → ProfileInfo<br>`importPasskey(name)` → ProfileInfo<br>`importMnemonic(name, words[], password)` → ProfileInfo<br>`exportEncrypted(id)` → string (base64)<br>`exportPlain(id, password?)` → string (base64)<br>`exportMnemonic(id, password)` → string[] (24 words) |
| **Events** | `onProfileAdded: ProfileInfo`<br>`onProfileUpdated: ProfileInfo`<br>`onProfileDeleted: ProfileInfo`<br>`onActiveProfileChanged: ProfileInfo \| undefined` |
| **Storage** | `nulo:core:profiles` (EntityStorage, Local)<br>`nulo:core:session` (ValueStorage, Session) |
| **Dependencies** | PasskeyService (direct, line 12); IConfig (injected in constructor) |
| **PXE/External** | None; pure crypto |
| **Aztec Deps** | @aztec/foundation/curves/bn254 (Fr for secret), encryption/key derivation utilities |
| **Testability** | **Needs mocks:** PasskeyService for passkey profiles. Encryption/decryption logic is unit-testable. Session TTL logic requires time mocks. |
| **Pattern Break** | Direct PasskeyService import (line 12). Config injection is tightly coupled. |

### 16. **PxeServiceClient** (Offscreen Isolation)
**Path:** `/pxe/`  
**Responsibility:** RPC client to offscreen PXE service; handles schema validation for all PXE operations; wraps offscreen execution.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getPXE(network)` → IPXE (proxy wrapper)<br>`getContractInstance(network, address, opts?)` → ContractInstanceWithAddress \| undefined<br>`getContractArtifact(network, id, opts?)` → ContractArtifact \| undefined<br>`registerAccount(network, secretKey, partialAddress)` → CompleteAddress<br>`registerSender(network, address)` → AztecAddress<br>`getSenders(network)` → AztecAddress[]<br>`removeSender(network, address)` → void<br>`getRegisteredAccounts(network)` → CompleteAddress[]<br>`registerContractClass(network, artifact)` → void<br>`registerContract(network, contract)` → void<br>`updateContract(network, contractAddress, artifact)` → void<br>`getContracts(network)` → AztecAddress[]<br>`getNotes(network, filter)` → NoteDao[]<br>`proveTx(network, txRequest, scopes)` → TxProvingResult<br>`profileTx(network, txRequest, opts)` → TxProfileResult<br>`simulateTx(network, txRequest, opts, stubAccountAddresses?)` → TxSimulationResult<br>`executeUtility(network, call, opts)` → UtilityExecutionResult<br>`getPrivateEvents<_T>(network, eventSelector, filter)` → PackedPrivateEvent[] |
| **Events** | None |
| **Storage** | None |
| **Dependencies** | Calls `ensureOffscreenRunning()` before each request |
| **PXE/External** | **Bridge to offscreen PXE:** All methods use `this.request()` to offscreen ServiceClient |
| **Aztec Deps** | Heavy schema validation (ContractInstanceWithAddressSchema, ContractArtifactSchema, AztecAddress.schema, etc.). |
| **Testability** | **Needs mocks:** Offscreen execution must be mocked. Schema parsing is unit-testable in isolation. |
| **Pattern Break** | ServiceClient inherits from ServiceClient<Methods> but does NOT implement a normal RPC interface—it IS the RPC bridge itself. Separate "proxy" pattern (PXEProxy wrapping this client). |

### 17. **RpcService** (Not in standard location)
**Location:** No standard service.ts/client.ts/spec.ts  
**Note:** RPC infrastructure exists at `/rpc/` but is not a traditional service. Contains service.ts/client.ts/spec.ts but appears to be part of the RPC communication layer, not a business service.

### 18. **TaskService**
**Path:** `/task/`  
**Responsibility:** Tracks task hierarchy (parent/subtask) for long-running operations (transactions, token imports, authwit syncs); provides progress tracking and error capture.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `createNewTask(content, parentId?, origin?)` → WrappedTask (Pending)<br>`startNewTask(content, parentId?, origin?)` → WrappedTask (Processing)<br>`getTaskById(id)` → Task (internal)<br>`completeTask(id, result?)` → void (internal)<br>`failTask(id, error)` → void (internal)<br>`cancelTask(id)` → void (internal) |
| **Events** | `onTaskCreated: Task`<br>`onTaskUpdated: Task`<br>`onTaskDeleted: Task` |
| **Storage** | In-memory Map (not persisted; cleared on profile change per line 42) |
| **Dependencies** | ProfileService (for profile lifecycle) |
| **PXE/External** | None |
| **Aztec Deps** | None |
| **Testability** | **Trivially unit-testable:** In-memory state. No PXE. No external calls. Pure state management. |

### 19. **TokenService** ← Complex (Introspection + Storage)
**Path:** `/token/`  
**Responsibility:** Manages token metadata and function signatures; introspects contracts to detect capabilities (public/private transfers, balances); stores token ABI references.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getTokens(profileId?, chainId?)` → TokenInfo[] (capabilities included)<br>`getTokensRaw(profileId?, chainId?)` → Token[] (raw storage)<br>`getToken(id)` → TokenInfo<br>`getTokenRaw(id)` → Token<br>`addToken(profileId, networkId, accountAddress, tokenInterface, parentTask?)` → TokenInfo<br>`updateToken(...)` → TokenInfo<br>`deleteToken(id)` → TokenInfo<br>`getTokenInterface(networkId, tokenId)` → TokenInterface (fetches from on-chain)<br>`parseTokenInterface(networkId, contract)` → TokenInterface (introspects contract) |
| **Events** | `onTokenAdded: TokenInfo`<br>`onTokenUpdated: TokenInfo`<br>`onTokenDeleted: TokenInfo` |
| **Storage** | `nulo:core:tokens` (EntityStorage, Local) |
| **Dependencies** | NetworkService, ProfileService, AccountService, PxeServiceClient (new), TaskService |
| **PXE/External** | Via PXE: `.getContracts()`, contract introspection to find function signatures; via `simulate()` utility to test balance/transfer functions |
| **Aztec Deps** | FunctionType inspection, ABI decoding, contract simulation |
| **Testability** | **Requires PXE/node:** Contract introspection is PXE-dependent. Function signature matching is unit-testable. |

### 20. **TokenBalanceService** ← Complex (Async Sync)
**Path:** `/token-balance/`  
**Responsibility:** Maintains token balance snapshots for all (token, account) pairs; async worker syncs balances via ExecutionService views; queues refresh requests.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getTokenBalance(id)` → TokenBalanceInfo<br>`getTokenBalances(tokenId?, accountAddress?)` → TokenBalanceInfo[]<br>`refreshTokenBalance(id)` → void (enqueues async sync) |
| **Events** | `onTokenBalanceAdded: TokenBalanceInfo`<br>`onTokenBalanceUpdated: TokenBalanceInfo`<br>`onTokenBalanceDeleted: TokenBalanceInfo` |
| **Storage** | `nulo:core:token-balances` (EntityStorage, Local) |
| **Dependencies** | ProfileService, NetworkService, AccountService, TokenService, ExecutionService, TransactionService, TaskService (all direct) |
| **PXE/External** | Via ExecutionService (indirect): executes balance view functions |
| **Aztec Deps** | FunctionType, BalanceOfPrivateFn, BalanceOfPublicFn (ViewFn wrappers) |
| **Testability** | **Essentially un-unit-testable:** Tight coupling to ExecutionService. Async worker (line 73) with complex state machine. Queue-based architecture requires careful mocking. |
| **Pattern Break** | Direct imports of ExecutionService, TransactionService, TaskService. Async worker managed internally with complex state. |

### 21. **TransactionService** ← Critical (Tx Tracking)
**Path:** `/transaction/`  
**Responsibility:** Stores submitted transactions; tracks status polling via worker; captures gas details and fee estimates at submission time.

| Aspect | Details |
|--------|---------|
| **Public Methods** | `getTransactions(account)` → Tx[]<br>`getTransaction(hash)` → Tx<br>`addTransaction(origin, chainId, account, calls[], nonce, feePaymentMethod, hash, estimatedFee?, gasDetails?)` → Tx<br>`waitForTx(txHash, parentTask?)` → void (blocks until pending complete) |
| **Events** | `onTransactionAdded: Tx`<br>`onTransactionUpdated: Tx`<br>`onTransactionDeleted: Tx` |
| **Storage** | `nulo:core:txs` (EntityStorage, Local) |
| **Dependencies** | ProfileService, AccountService, NetworkService, PxeServiceClient (new) |
| **PXE/External** | Worker polls PXE for tx status via `.getTxStatus(txHash, nodeInfo)` |
| **Aztec Deps** | TxHash, TxStatus (Pending → Proposed → Checkpointed → Proven → Finalized), TxExecutionResult (Success/AppLogicReverted/etc) |
| **Testability** | **Requires PXE/node:** Worker polls PXE. Otherwise, add/waitFor are unit-testable with proper mocking. |

### 22. **WalletSdkIntegration** (Not a standard service)
**Path:** `/wallet-sdk/`  
**Responsibility:** Dispatcher + capability enforcement for wallet-sdk clients; bridges capability-based sessions to internal service execution.

**Note:** This is not a traditional service (no spec.ts). Contains:
- `dispatcher.ts` — Routes SDK operations through DappInteractionService
- `background.ts` — Offscreen PXE setup
- `scope-enforcement.ts` — Validates operation scopes against granted capabilities
- `capability-map.ts` — Maps capabilities to operation kinds

| Aspect | Details |
|--------|---------|
| **Integration Point** | Sits between wallet-sdk (external) and DappInteractionService / ExecutionService |
| **Key Logic** | Enforces scope restrictions; translates CAIP notation; validates capabilities |
| **Dependencies** | DappInteractionService, ExecutionService (via dispatcher integration) |
| **Testability** | Scope enforcement logic is unit-testable. Dispatcher is integration-testable only. |

---

## Storage Key Registry

| Key | Service | Type | Scope |
|-----|---------|------|-------|
| `nulo:core:accounts` | AccountService | EntityStorage | Profile × Chain |
| `nulo:core:auth-registry` | AuthRegistryService | EntityStorage | Global (by authwit ID) |
| `nulo:core:auth-registry-enabled` | AuthRegistryService | EntityStorage | Account address → boolean |
| `nulo:core:contacts` | ContactService | EntityStorage | Profile scoped |
| `nulo:core:dappSessions` | DappSessionService | EntityStorage | Profile scoped; auto-expires |
| `nulo:core:fpcs` | FpcService | EntityStorage | Profile × Chain |
| `nulo:core:networks` | NetworkService | EntityStorage | Profile scoped |
| `nulo:core:profiles` | ProfileService | EntityStorage | Global (all users) |
| `nulo:core:session` | ProfileService | ValueStorage (Session storage) | Single active session |
| `nulo:core:token-balances` | TokenBalanceService | EntityStorage | Profile × Chain × Account × Token |
| `nulo:core:tokens` | TokenService | EntityStorage | Profile × Chain |
| `nulo:core:txs` | TransactionService | EntityStorage | Global (by tx hash) |

---

## Dependency Graph

### Direct Service Dependencies (Imports)

```
ProfileService (root)
├── PasskeyService (passkey creation)
│
AccountService
├── ProfileService (secret derivation)
│
ContactService
├── ProfileService (profile scope)
│
DappSessionService
├── ProfileService (profile scope)
│
NetworkService
├── ProfileService (profile scope)
│
FpcService
├── ProfileService (profile scope)
├── NetworkService (network → chain → node)
└── PxeServiceClient (FPC discovery)
│
PxeServiceClient (offscreen bridge)
└── (runs in offscreen document)
│
TokenService
├── ProfileService
├── NetworkService
├── AccountService
├── TaskService
└── PxeServiceClient
│
ExecutionService ⭐ (Most Depended-On)
├── NetworkService (get chain node)
├── PxeServiceClient (simulate, prove, register)
├── AccountService (get account contract)
├── ContactService (get contact name)
├── ProfileService (active profile)
├── AuthRegistryService (track authwits during execution)
├── TokenService (token metadata)
├── FpcService (fee payment)
├── TaskService (track execution progress)
└── TransactionService (register completed tx)
│
TransactionService
├── ProfileService
├── AccountService
├── NetworkService
└── PxeServiceClient (poll tx status)
│
TokenBalanceService ⭐ (Second Most Depended-On)
├── ProfileService
├── AccountService
├── NetworkService
├── TokenService
├── ExecutionService (call balance views)
├── TransactionService (listen for tx updates)
└── TaskService (track syncs)
│
AuthRegistryService
├── ProfileService
├── NetworkService
├── AccountService
├── ExecutionService (send revoke/enable txs)
├── TransactionService (wait for tx)
└── TaskService (track auth ops)
│
DappInteractionService
├── ProfileService
├── NetworkService
├── AccountService
├── DappSessionService (get session permissions)
└── ExecutionService (execute approved ops)
│
AccountStateService
├── NetworkService
└── PxeServiceClient (get registered accounts/senders)
│
NoteService
├── NetworkService
└── PxeServiceClient (get private notes)
│
ConfigService
└── (no service dependencies; delegates to IConfigStore)
│
LoggerService
└── (no service dependencies; delegates to LoggerStore)
│
LogViewerService
└── (no service dependencies; delegates to ILoggerStore)
│
PasskeyService
└── (no service dependencies)
│
TaskService
└── ProfileService (clear tasks on logout)
```

### Reverse Dependency (Who Depends On Each Service)

| Service | Depended By | Count |
|---------|------------|-------|
| **ProfileService** | AccountService, ContactService, DappSessionService, NetworkService, FpcService, TokenService, ExecutionService, TransactionService, TokenBalanceService, AuthRegistryService, DappInteractionService, TaskService | **12** |
| **ExecutionService** | AuthRegistryService, TokenBalanceService, DappInteractionService | **3** |
| **TokenBalanceService** | (none as service dependency; listened to by itself) | **0** |
| **PxeServiceClient** | AccountStateService, NoteService, FpcService, TokenService, TokenBalanceService, TransactionService | **6** |
| **NetworkService** | FpcService, TokenService, TokenBalanceService, ExecutionService, TransactionService, AuthRegistryService, DappInteractionService, AccountStateService, NoteService | **9** |
| **AccountService** | ExecutionService, TokenBalanceService, DappInteractionService, TransactionService, AuthRegistryService | **5** |
| **TaskService** | ExecutionService, TokenBalanceService, AuthRegistryService, TokenService | **4** |
| **TransactionService** | TokenBalanceService, AuthRegistryService | **2** |
| **TokenService** | TokenBalanceService, ExecutionService | **2** |
| **DappSessionService** | DappInteractionService | **1** |
| **FpcService** | ExecutionService | **1** |
| **ContactService** | ExecutionService | **1** |

---

## "God Services" Analysis

### Tier 1: Architectural Gods

**1. ExecutionService** (CRITICAL ORCHESTRATOR)
- Depended on by: 3 services (AuthRegistry, TokenBalance, DappInteraction)
- Imports: 10 services (Network, Pxe, Account, Contact, Profile, AuthRegistry, Token, Fpc, Task, Transaction)
- Direct imports break RPC abstraction at: /service.ts:4-10, 48, 68-70
- Responsibility: Simulate + execute any operation; routes through multiple services
- Testability: Un-unit-testable; too many real service dependencies
- LoC: 600+

**2. TokenBalanceService** (ASYNC SYNC ENGINE)
- Depended on by: 0 (but observes 6 other services)
- Imports: 7 services (Account, Network, Profile, Token, Execution, Transaction, Task)
- Worker-based async: Continuously syncs via ExecutionService
- Testability: Un-unit-testable; complex async state machine
- LoC: 300+

**3. ProfileService** (ROOT SESSION GATE)
- Depended on by: 12 services (most of the system)
- Every method checks profile lock/active status
- Encryptor/decryptor for all secrets
- Testability: Needs PasskeyService + encryption mocks; otherwise unit-testable
- LoC: 400+

### Tier 2: Critical Infrastructure

**4. NetworkService** (CHAIN/NODE CACHE)
- Depended on by: 9 services
- Caches AztecNode instances per chainId
- Default network initialization
- Testability: Needs RPC endpoint mock; otherwise unit-testable

**5. AuthRegistryService** (AUTHWIT TRACKER)
- Complex: Creates tasks, executes txs, syncs contract state
- Depended on by: 1 service (but used directly by 3+)
- Pattern break: Direct ExecutionService import
- Testability: Un-unit-testable; massive tight coupling

---

## Coupling Violations (RPC Abstraction Bypasses)

| Service | Violates At | Pattern |
|---------|-------------|---------|
| **ExecutionService** | /service.ts:4-10, 48, 68-70 | Direct imports of AuthRegistry, Fpc, Token; creates new PxeServiceClient instead of using abstraction |
| **AuthRegistryService** | /service.ts:4-10 | Direct imports of Execution, Transaction, Task; no client-side abstraction |
| **DappInteractionService** | /service.ts:54-58 | Direct imports of all 5 dependencies; should use clients |
| **TokenBalanceService** | /service.ts:50-57 | Direct imports of Execution, Transaction; should use clients |
| **FpcService** | /service.ts:45-47 | New PxeServiceClient instance; should use injected abstraction |
| **TokenService** | /service.ts:52-57 | New PxeServiceClient instance |
| **NoteService** | /service.ts:24 | New PxeServiceClient instance |
| **TransactionService** | /service.ts:52 | New PxeServiceClient instance |
| **AccountStateService** | /service.ts:36 | New PxeServiceClient instance |
| **PasskeyService** | /service.ts:59-86 | Direct `chrome.windows.create()` calls; no abstraction |
| **DappInteractionService** | /service.ts:173-193 | Direct `chrome.windows.create()` calls |

---

## Testability Summary

| Service | Score | Reason |
|---------|-------|--------|
| ConfigService | 🟢 Trivial | Pure proxy; no dependencies |
| LoggerService | 🟢 Trivial | Pure proxy; no dependencies |
| LogViewerService | 🟢 Trivial | Pure proxy; no dependencies |
| TaskService | 🟢 Trivial | In-memory state; no PXE |
| ContactService | 🟡 Needs Mocks | ProfileService dependency; Lock concurrency |
| DappSessionService | 🟡 Needs Mocks | ProfileService, Lock, expiry logic |
| PasskeyService | 🔴 Un-testable | Chrome API, WebAuthn browser APIs |
| ConfigService | 🟢 Trivial | Pure proxy; no dependencies |
| LoggerService | 🟢 Trivial | Pure proxy; no dependencies |
| TokenService | 🔴 Requires PXE/Node | Contract introspection; PXE calls |
| NoteService | 🔴 Requires PXE/Node | All methods call PXE |
| AccountStateService | 🔴 Requires PXE/Node | All methods call PXE |
| FpcService | 🔴 Requires PXE/Node | FPC discovery + type detection |
| TokenBalanceService | 🔴 Un-testable | Async worker; Execution coupling; state machine |
| TransactionService | 🔴 Requires PXE/Node | Worker polls PXE; otherwise testable |
| AuthRegistryService | 🔴 Un-testable | Execution + Transaction + Task coupling; no RPC abstraction |
| ExecutionService | 🔴 Un-testable | 10+ service imports; 600+ LoC orchestration; no abstraction |
| DappInteractionService | 🔴 Un-testable | Chrome windows; complex permission validation; Execution coupling |
| PxeServiceClient | 🟡 Needs Mocks | Offscreen execution mocking required |
| AccountService | 🟡 Needs Mocks | ProfileService mock for secret derivation |
| NetworkService | 🟡 Needs Mocks | RPC endpoint mock; AztecNode instantiation |
| ProfileService | 🟡 Needs Mocks | PasskeyService + encryption/decryption mocks |

---

## Critical Design Debt

### 1. **No Service Client Abstraction for 8+ Services**
Services instantiate PxeServiceClient directly instead of using injected abstraction:
- FpcService, TokenService, NoteService, TransactionService, AccountStateService, ExecutionService
- Blocks unit testing without actual PXE
- Violates dependency injection principle

### 2. **Direct Service Imports Instead of Clients**
ExecutionService imports 10 services directly; AuthRegistryService imports 6; TokenBalanceService imports 7.
- Should use ServiceClient RPC abstraction
- Currently forces test mocks to mock entire service implementations
- Example: AuthRegistryService line 4-10 imports ExecutionService, TaskService, TransactionService as concrete classes

### 3. **Chrome API Not Abstracted**
DappInteractionService (line 173-193) and PasskeyService (line 59-86) embed chrome.windows.create directly.
- Should delegate to Window management service
- Makes popup flow untestable

### 4. **No RPC-Based DappInteraction**
DappInteractionService methods like `execute()` are exposed as public non-RPC methods.
- Bypasses the RPC request/response pattern
- Relies on direct event resolution via Promise callbacks
- Creates test complexity

### 5. **Async Workers Without Abstraction**
TokenBalanceService starts internal worker (line 73); TransactionService has internal polling logic.
- No abstraction over worker lifecycle
- Difficult to mock or test; state pollution between tests
- No observable worker state exposed

### 6. **PxeServiceClient Dual Role**
PxeServiceClient both:
- Acts as RPC client to offscreen document (correct)
- Is instantiated directly by 8+ services (incorrect)

Should be:
- Always injected as dependency
- Single instance per service lifecycle
- Testable via mock injection

---

## Recommended Refactoring Priorities

1. **Create ServiceClient wrappers for:**
   - FpcService → FpcServiceClient
   - TokenService → TokenServiceClient (already exists but not used by TokenBalanceService)
   - TransactionService → already has client; not used everywhere
   - AuthRegistryService → AuthRegistryServiceClient (already exists but not used)

2. **Extract Window Management Service:**
   - Abstract chrome.windows.create
   - DappInteractionService and PasskeyService depend on abstraction
   - Make popup flow mockable

3. **Inject PxeServiceClient:**
   - Create factory for PxeServiceClient injection
   - Stop new PxeServiceClient() instantiations
   - Single instance, proper lifecycle

4. **Introduce Async Worker Abstraction:**
   - TokenBalanceService, TransactionService expose worker states
   - Make testable via lifecycle hooks
   - Observable state for tests

---

## End of Inventory

This document captures the complete service topology, dependency graph, storage layout, and architectural issues. Use it as a reference for:
- Understanding service responsibilities
- Identifying God Services for potential refactoring
- Recognizing testability bottlenecks
- Finding coupling violations and design debt
