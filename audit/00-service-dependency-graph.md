# Phase 0.4 & 0.5: Service Dependency Graph

## Overview

The background service worker runs **23 services** (22 in the main SW + PXE in offscreen). They are all registered in `src/wallet/index.ts` and started concurrently via `Promise.all()`.

---

## Initialization Architecture

```typescript
// src/wallet/index.ts:101
await services.start()  // → Promise.all(services.map(s => s.start(this)))
```

Each service's `start()` method:
1. Calls `init(services: ServiceCollection)` — retrieves dependencies from collection
2. Sets `initialized = true`
3. Public methods guard with `ensureInitialized()` (30-second timeout)

**Key property:** All services are added to the collection BEFORE `start()` is called, so circular `init()` references are safe — they're retrieving already-registered instances, not causing construction cycles.

---

## Complete Dependency Graph

### Forward Dependencies (who depends on whom)

```
ProfileService ◄──────────────────────────────────────────────────────┐
  └─► PasskeyService                                                  │
                                                                      │
AccountService ◄───────────────────────────────────────────────┐      │
  └─► ProfileService                                           │      │
                                                               │      │
AccountStateService                                            │      │
  ├─► PxeServiceClient                                         │      │
  └─► NetworkService                                           │      │
                                                               │      │
AuthRegistryService ◄─────────────────────────┐                │      │
  ├─► ProfileService                          │                │      │
  ├─► NetworkService                          │                │      │
  ├─► AccountService                          │                │      │
  ├─► ExecutionService ◄──── CIRCULAR ────────┤                │      │
  ├─► TransactionService                      │                │      │
  └─► TaskService                             │                │      │
                                              │                │      │
ConfigService                                 │                │      │
  (no service dependencies)                   │                │      │
                                              │                │      │
ContactService                                │                │      │
  └─► ProfileService                          │                │      │
                                              │                │      │
DappInteractionService                        │                │      │
  ├─► ProfileService                          │                │      │
  ├─► NetworkService                          │                │      │
  ├─► AccountService                          │                │      │
  ├─► DappSessionService                      │                │      │
  └─► ExecutionService ──────────────────────►│                │      │
                                              │                │      │
DappSessionService                            │                │      │
  └─► ProfileService                          │                │      │
                                              │                │      │
ExecutionService ═══════════ HUB ═════════════╝                │      │
  ├─► PxeServiceClient                                         │      │
  ├─► ProfileService ─────────────────────────────────────────►│──────┤
  ├─► NetworkService                                           │      │
  ├─► AccountService ─────────────────────────────────────────►│      │
  ├─► ContactService                                                  │
  ├─► TokenService                                                    │
  ├─► FpcService                                                      │
  ├─► TransactionService                                              │
  ├─► AuthRegistryService (CIRCULAR)                                  │
  └─► TaskService                                                     │
                                                                      │
FaucetService                                                         │
  ├─► PxeServiceClient                                                │
  ├─► ProfileService ────────────────────────────────────────────────►│
  ├─► NetworkService                                                  │
  ├─► AccountService                                                  │
  ├─► ExecutionService                                                │
  ├─► TransactionService                                              │
  └─► TaskService                                                     │
                                                                      │
FpcService                                                            │
  ├─► PxeServiceClient                                                │
  ├─► ProfileService ────────────────────────────────────────────────►│
  └─► NetworkService                                                  │
                                                                      │
LogViewerService                                                      │
  └─► ILoggerStore (direct, not via init)                             │
                                                                      │
LoggerService                                                         │
  └─► ILogger (direct)                                                │
                                                                      │
NetworkService                                                        │
  └─► ProfileService ────────────────────────────────────────────────►│
                                                                      │
NoteService                                                           │
  ├─► PxeServiceClient                                                │
  └─► NetworkService                                                  │
                                                                      │
PasskeyService                                                        │
  (no service dependencies)                                           │
                                                                      │
PxeService (offscreen)                                                │
  ├─► ProfileServiceClient (RPC client)                               │
  └─► ConfigServiceClient (RPC client)                                │
                                                                      │
RpcService                                                            │
  ├─► DappSessionService                                              │
  └─► DappInteractionService                                         │
                                                                      │
TaskService                                                           │
  └─► ProfileService ────────────────────────────────────────────────►│
                                                                      │
TokenService                                                          │
  ├─► PxeServiceClient                                                │
  ├─► ProfileService ────────────────────────────────────────────────►│
  ├─► NetworkService                                                  │
  ├─► AccountService ────────────────────────────────────────────────►│
  └─► TaskService                                                     │
                                                                      │
TokenBalanceService                                                   │
  ├─► ProfileService ────────────────────────────────────────────────►│
  ├─► NetworkService                                                  │
  ├─► AccountService ────────────────────────────────────────────────►│
  ├─► TokenService                                                    │
  ├─► TransactionService                                              │
  ├─► ExecutionService                                                │
  └─► TaskService                                                     │
                                                                      │
TransactionService                                                    │
  ├─► ProfileService ────────────────────────────────────────────────►│
  ├─► AccountService ────────────────────────────────────────────────►│
  ├─► NetworkService                                                  │
  ├─► TaskService                                                     │
  └─► PxeServiceClient                                                │
                                                                      │
WalletConnectService                                                  │
  ├─► DappSessionService                                              │
  └─► DappInteractionService                                         │
```

---

## Reverse Dependencies (who depends on me)

| Service | Depended On By | Count |
|---------|---------------|-------|
| **ProfileService** | account, auth-registry, contact, dapp-interaction, dapp-session, execution, faucet, fpc, network, task, token, token-balance, transaction, pxe(offscreen) | **14** |
| **NetworkService** | account-state, auth-registry, dapp-interaction, execution, faucet, fpc, note, token, token-balance, transaction | **10** |
| **AccountService** | auth-registry, dapp-interaction, execution, faucet, token, token-balance, transaction | **7** |
| **ExecutionService** | auth-registry, dapp-interaction, faucet, token-balance | **4** |
| **TaskService** | auth-registry, execution, faucet, token, token-balance, transaction | **6** |
| **TransactionService** | auth-registry, execution, faucet, token-balance | **4** |
| **TokenService** | execution, token-balance | **2** |
| **DappSessionService** | dapp-interaction, rpc, wallet-connect | **3** |
| **DappInteractionService** | rpc, wallet-connect | **2** |
| **FpcService** | execution | **1** |
| **ContactService** | execution | **1** |
| **PasskeyService** | profile | **1** |
| **PxeServiceClient** | account-state, execution, faucet, fpc, note, token, transaction | **7** |

---

## Circular Dependencies

### ExecutionService <-> AuthRegistryService

```
ExecutionService.init() → retrieves AuthRegistryService
AuthRegistryService.init() → retrieves ExecutionService

Runtime calls:
  ExecutionService.buildTxRequest()
    → AuthRegistryService.trackAuthwit() [tracking auth witnesses]

  AuthRegistryService.revokeAuthwits()
    → ExecutionService.executeSendTransaction() [revoking via transaction]

  AuthRegistryService.setRegistryEnabled()
    → ExecutionService.executeSendTransaction() [enabling via transaction]
```

**Assessment:** This is a **logical cycle** (runtime method calls), not a **construction cycle**. Both services are fully initialized before any runtime calls occur. The cycle is architecturally justified — auth witnesses are part of transaction execution, and revoking them requires sending transactions.

**Risk:** LOW — No initialization deadlock possible. No infinite recursion possible (revocation doesn't create auth witnesses that need revocation).

---

## Service Categories by Role

### Tier 1: Foundation (zero or minimal dependencies)
| Service | Dependencies | Role |
|---------|-------------|------|
| ConfigService | none | Wallet configuration |
| PasskeyService | none | WebAuthn credential management |
| LoggerService | ILogger | Logging |
| LogViewerService | ILoggerStore | Log viewing |

### Tier 2: Core Infrastructure
| Service | Dependencies | Role |
|---------|-------------|------|
| ProfileService | PasskeyService | Authentication, session, secrets |
| NetworkService | ProfileService | Network/node management |
| TaskService | ProfileService | Background task tracking |

### Tier 3: Domain Services
| Service | Dependencies | Role |
|---------|-------------|------|
| AccountService | ProfileService | Account CRUD, secret derivation |
| ContactService | ProfileService | Address book |
| DappSessionService | ProfileService | dApp session management |
| FpcService | PxeClient, ProfileService, NetworkService | Fee payment contracts |
| NoteService | PxeClient, NetworkService | Note queries |
| TokenService | PxeClient, Profile, Network, Account, Task | Token management |

### Tier 4: Orchestration
| Service | Dependencies | Role |
|---------|-------------|------|
| **ExecutionService** | **10 services** | Transaction construction hub |
| DappInteractionService | 5 services | dApp permission & execution |
| AuthRegistryService | 6 services | Authorization witness mgmt |
| TransactionService | 5 services | Transaction history & sync |
| FaucetService | 7 services | Testnet faucet |
| TokenBalanceService | 7 services | Balance tracking |

### Tier 5: External Interface
| Service | Dependencies | Role |
|---------|-------------|------|
| RpcService | DappSession, DappInteraction | dApp RPC endpoint |
| WalletConnectService | DappSession, DappInteraction | WC protocol |
| AccountStateService | PxeClient, NetworkService | PXE account state |
| PxeService (offscreen) | ProfileClient, ConfigClient | Private execution |

---

## Storage Key Map

| Service | Storage Key | Type | Sensitivity |
|---------|------------|------|-------------|
| AccountService | `azguard:core:accounts` | EntityStorage (Local) | Medium - addresses, names |
| AuthRegistryService | `azguard:core:auth-registry` | EntityStorage (Local) | Medium - authwit hashes |
| AuthRegistryService | `azguard:core:auth-registry-enabled` | EntityStorage (Local) | Low - boolean flags |
| ContactService | `azguard:core:contacts` | EntityStorage (Local) | Low - names, addresses |
| DappSessionService | `azguard:core:dappSessions` | EntityStorage (Local) | **High** - permissions, accounts |
| FpcService | `azguard:core:fpcs` | EntityStorage (Local) | Low - FPC addresses |
| NetworkService | `azguard:core:networks` | EntityStorage (Local) | Low - RPC URLs, chain IDs |
| ProfileService | `azguard:core:profiles` | EntityStorage (Local) | **Critical** - encrypted secrets |
| ProfileService | `azguard:core:session` | ValueStorage (Session) | **High** - passhash, TTL |
| TokenService | `azguard:core:tokens` | EntityStorage (Local) | Low - token metadata |
| TokenBalanceService | `azguard:core:token-balances` | EntityStorage (Local) | Medium - balance values |
| TransactionService | `azguard:core:txs` | EntityStorage (Local) | Medium - tx history |
| TransactionService | `azguard:core:tx-cursors` | EntityStorage (Local) | Low - sync cursors |

**Total storage keys: 13**
**Encrypted at rest: 1** (profile secrets only)
**Session-scoped: 1** (session with passhash)
**Persistent plaintext: 11**

---

## Event Subscriptions (Cross-Service Reactivity)

```
ProfileService.onProfileDeleted
  → AccountService (delete profile accounts)
  → ContactService (delete profile contacts)
  → DappSessionService (delete profile sessions)
  → FpcService (delete profile FPCs)
  → TokenService (delete profile tokens)

ProfileService.onActiveProfileChanged
  → NetworkService (reload networks)
  → TokenBalanceService (reload balances)
  → TransactionService (reload transactions)

AccountService.onAccountAdded
  → TokenBalanceService (create balance entries)

AccountService.onAccountDeleted
  → TransactionService (cleanup)

TokenService.onTokenAdded/Updated/Deleted
  → TokenBalanceService (sync balance entries)

TransactionService.onTransactionUpdated
  → TokenBalanceService (refresh affected balances)

DappSessionService.onDappSessionUpdated/Deleted
  → RpcService → emit onGenericEvent → content script → page
```

---

## Findings

**[F-SD-01] INFO - ProfileService is Single Point of Failure**
- 14 out of 22 services depend on ProfileService
- If ProfileService crashes or enters an invalid state, the entire wallet is non-functional
- No fallback or health check mechanism for ProfileService
- **Recommendation:** Add health monitoring / recovery mechanism for ProfileService

**[F-SD-02] INFO - ExecutionService Has 10 Dependencies**
- Most connected service in the system
- Changes to any dependency can break transaction execution
- High blast radius for refactoring
- This is architecturally justified (execution needs all context)

**[F-SD-03] LOW - No Service Health Monitoring**
- Services can fail silently (no heartbeat between services)
- Background SW has a 10-second heartbeat (`setInterval(() => {}, 10_000)`) but only keeps the SW alive
- Individual service failures are not detected or reported
- **Recommendation:** Consider service-level health checks

**[F-SD-04] LOW - Concurrent Initialization Without Ordering**
- All services start via `Promise.all()` — no guaranteed ordering
- Services use `ensureInitialized()` guards with 30-second timeout
- This is correct but could cause slow startup if a dependency chain is deep
- **Recommendation:** Consider explicit initialization order for Tier 1→2→3→4→5

**[F-SD-05] INFO - 11 of 13 Storage Keys are Plaintext**
- Only profile secrets are encrypted at rest
- dApp sessions, transaction history, token balances, account metadata all stored plaintext
- An attacker with filesystem access can read all non-secret wallet data
- This is documented in the Storage & Data at Rest audit (Phase 4)
