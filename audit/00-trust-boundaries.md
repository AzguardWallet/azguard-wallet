# Phase 0.1: Trust Boundary Map

## Overview

Azguard Wallet has **6 trust boundaries** across 4 execution contexts. Every crossing is a potential attack surface.

```
┌─────────────────────────────────────────────────────────────────┐
│  UNTRUSTED: Web Page (any origin)                               │
│  window.azguard.createClient() → ProxyClient                   │
│                                                                 │
│  ┌───── Boundary 1: ECDH P-521 + AES-256-GCM ──────┐          │
│  │      Transport: window.postMessage                │          │
│  │      Auth: ECDH key agreement (no identity proof) │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                 │
│  SEMI-TRUSTED: Content Script (extension origin)                │
│  ProxyServer ↔ MServer (messenger)                              │
│                                                                 │
│  ┌───── Boundary 2: chrome.runtime.connect ──────────┐         │
│  │      Transport: Extension port (name-filtered)     │         │
│  │      Auth: Service name match only                 │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  TRUSTED: Background Service Worker                             │
│  23 services, chrome.storage, session management                │
│                                                                 │
│  ┌───── Boundary 3: chrome.runtime.connect ──────────┐         │
│  │      Transport: Extension port (name-filtered)     │         │
│  │      Auth: Service name match only                 │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  TRUSTED: Popup UI (Vue 3)                                      │
│  ServiceClients, Pinia stores, user interaction                 │
│                                                                 │
│  ┌───── Boundary 4: chrome.runtime.sendMessage ──────┐         │
│  │      Transport: Extension messaging (UUID-routed)  │         │
│  │      Auth: UUID + to/from fields                   │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  TRUSTED: Offscreen Document (PXE)                              │
│  Aztec PXE, Barretenberg WASM, IndexedDB                       │
│                                                                 │
│  ┌───── Boundary 5: HTTPS (TLS) ────────────────────┐          │
│  │      Transport: JSON-RPC over HTTPS                │          │
│  │      Auth: None (public endpoints)                 │          │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  EXTERNAL: Aztec Node RPC                                       │
│  Default: https://v4-devnet-2.aztec-labs.com                    │
│  Custom: User-configurable                                      │
│                                                                 │
│  ┌───── Boundary 6: HTTPS + E2E (WalletConnect) ────┐          │
│  │      Transport: WC Relay (encrypted)               │          │
│  │      Auth: TLS + end-to-end encryption             │          │
│  │      Default: DISABLED (opt-in)                    │          │
│  └────────────────────────────────────────────────────┘         │
│                                                                 │
│  EXTERNAL: WalletConnect Relay                                  │
│  Project ID: d809b7373c4209e576c9033266578783                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Boundary 1: Page Script <-> Content Script

### Transport
- `window.postMessage()` with `window.origin` as targetOrigin
- Channel identifier: `"azguard-inpage"` (constant)

### Encryption
- **ECDH P-521** key exchange (192-bit equivalent security)
- **AES-256-GCM** authenticated encryption per message
- Random 12-byte IV per message
- Per-client key derivation (separate key per `ProxyClient` instance)

### Handshake Protocol
1. Client generates P-521 keypair, sends public key in plaintext handshake
2. Server imports client pubkey, derives AES-256 shared secret, sends own pubkey back
3. Client derives same shared secret, marks channel ready
4. MITM detection: if second handshake arrives, client self-destructs (`this.#key = null`)

### Files
| Component | File | Key Lines |
|-----------|------|-----------|
| Page injection | `src/content-script/inpage.ts` | 4-12 |
| Content listener | `src/content-script/content.ts` | 5-13 |
| Page-side messenger | `src/content-script/proxy/messenger/client .ts` | 13-142 |
| Content-side messenger | `src/content-script/proxy/messenger/server.ts` | 13-140 |
| Crypto utilities | `src/content-script/proxy/messenger/utils.ts` | 6-82 |
| Injection utility | `src/content-script/utils.ts` | 1-11 |

### Data Crossing
**Page -> Background:** RPC method name, method parameters, session ID
**Background -> Page:** RPC results, error messages, session events

### Security Assessment

| Control | Status | Notes |
|---------|--------|-------|
| Encryption strength | GOOD | P-521 ECDH + AES-256-GCM |
| Per-client isolation | GOOD | Separate derived key per client |
| MITM detection | PARTIAL | First-handshake-wins; attacker who goes first wins |
| Authentication | MISSING | Server doesn't prove identity to client |
| Replay protection | GOOD | AES-GCM prevents replay (IV + auth tag) |
| Origin validation | PARTIAL | Uses `window.origin` but same-origin scripts can interfere |

### Findings

**[F-B1-01] MEDIUM - First-Handshake-Wins MITM Gap**
- File: `src/content-script/proxy/messenger/client .ts:117-126`
- If a malicious script completes the handshake before the legitimate content script, the attacker controls the channel
- The legitimate handshake is then rejected as "suspicious"
- Mitigation: The content script runs at `document_start` (before page scripts), making this race hard to win in practice

**[F-B1-02] LOW - No Server Authentication**
- The ECDH handshake provides confidentiality but not authentication
- A page script cannot verify it's talking to the real Azguard extension
- Impact: Low — page scripts are untrusted anyway; the extension decides what to expose

---

## Boundary 2: Content Script <-> Background Service Worker

### Transport
- `chrome.runtime.connect({ name: serviceName })` — persistent port
- Message types: `RequestMessage`, `ResponseMessage`, `EventMessage`
- Serialization: `jsonSanitize()` on all outbound data

### Authentication
- Port filtered by service name string match only
- No per-connection authentication or capability check
- Any context with `chrome.runtime` access can connect

### Message Format
```typescript
RequestMessage {
  type: MessageType.Request (2),
  content: {
    requestId: number,       // 1 + Math.random() (1.0 to 2.0)
    method: keyof Methods,   // Type-checked method name
    params: { 0: arg0, ... } // Wrapped positional args
  }
}

ResponseMessage {
  type: MessageType.Response (3),
  content: {
    requestId: number,
    result?: any,            // jsonSanitize(result)
    error?: string           // Error message only, no stack
  }
}
```

### Files
| Component | File | Key Lines |
|-----------|------|-----------|
| Service base (server) | `src/wallet/base/background/service.ts` | 9-97 |
| Client base | `src/wallet/base/background/client.ts` | 10-132 |
| Messages | `src/wallet/base/messages.ts` | 1-45 |
| Utilities | `src/wallet/base/utils.ts` | - |
| RPC service | `src/wallet/services/rpc/service.ts` | 19-115 |
| RPC client | `src/wallet/services/rpc/client.ts` | 9+ |

### Data Crossing
- RPC method invocations from content script
- Session tracking (session ID -> client mapping)
- Event broadcasts (session updates, deletions)

### Security Assessment

| Control | Status | Notes |
|---------|--------|-------|
| Port name filtering | BASIC | Only checks `client.name !== this.name` |
| Method validation | GOOD | Validates `method in this.requests` |
| Parameter sanitization | GOOD | `jsonSanitize()` on results/events |
| Error sanitization | GOOD | Only error message string, no stack |
| Per-request auth | MISSING | No capability/permission check per request |
| Request ID entropy | WEAK | `1 + Math.random()` — ~53 bits of entropy |

### Findings

**[F-B2-01] HIGH - No Per-Connection Authentication**
- File: `src/wallet/base/background/service.ts:39-47`
- Any script with `chrome.runtime` access can connect by knowing the service name
- Service names are predictable strings ("rpc", "account", "profile", etc.)
- Impact: Content scripts are part of the extension, but a compromised content script gets full service access

**[F-B2-02] MEDIUM - Weak Request ID Generation**
- File: `src/wallet/base/background/client.ts:128-132`
- `1 + Math.random()` produces ~53 bits of entropy (IEEE 754 double precision)
- Collision-checked against pending requests map, but predictable
- Impact: Low in practice — request IDs are only meaningful within a single port connection

---

## Boundary 3: Popup UI <-> Background Service Worker

### Transport
Identical to Boundary 2 — same `Service`/`ServiceClient` base classes. The popup creates typed service clients (e.g., `NetworkServiceClient`, `ProfileServiceClient`) that connect via `chrome.runtime.connect()`.

### Difference from Boundary 2
- Popup is a **trusted** extension page (same origin as background)
- Popup has access to all 23 service clients
- No content script intermediary

### Security Assessment
Same controls and findings as Boundary 2. The popup is inherently trusted as an extension page.

---

## Boundary 4: Background <-> Offscreen Document (PXE)

### Transport
- `chrome.runtime.sendMessage()` (one-shot, not persistent port)
- Extended message format with `from` (sender UUID) and `to` (service name) fields
- Client generates 8-hex-char UUID for routing responses

### Files
| Component | File | Key Lines |
|-----------|------|-----------|
| Offscreen service base | `src/wallet/base/offscreen/service.ts` | 10-85 |
| Background client | `src/wallet/base/offscreen/client.ts` | 9-110 |
| Messages | `src/wallet/base/offscreen/messages.ts` | 13-15 |
| PXE entry point | `src/offscreen/index.ts` | 23 |

### Data Crossing

**Background -> Offscreen:**
- Account secret keys (for `registerAccount`)
- Contract artifacts and instances
- Transaction execution requests
- Simulation parameters

**Offscreen -> Background:**
- Complete addresses
- Notes (encrypted outputs)
- Simulation results
- Proved transactions

### Security Assessment

| Control | Status | Notes |
|---------|--------|-------|
| Service name routing | GOOD | Checks `message.to === this.name` |
| Sender UUID | BASIC | 8 hex chars = 32 bits of entropy |
| Encryption | NONE | Plaintext within extension (acceptable) |
| Secret forwarding | CONCERN | Account secrets cross this boundary |

### Findings

**[F-B4-01] INFO - Secrets Cross Boundary to PXE**
- Account secret keys are sent to the offscreen PXE via `registerAccount()`
- The offscreen document stores these in IndexedDB for PXE operation
- This is architecturally necessary but expands the secret's attack surface
- If the offscreen document is compromised, all registered account secrets are exposed

---

## Boundary 5: Background <-> Aztec Node RPC

### Transport
- HTTPS JSON-RPC
- Default endpoint: `https://v4-devnet-2.aztec-labs.com`
- User-configurable (custom RPC URLs allowed)
- Localhost fallback: `http://localhost:8080`

### Files
| Component | File | Key Lines |
|-----------|------|-----------|
| Network service | `src/wallet/services/network/service.ts` | 287-299 |
| PXE service (node queries) | `src/wallet/services/pxe/service.ts` | 97-121 |

### Data Sent to Node
- Account addresses (public, but links address to IP)
- Contract address lookups
- Transaction submissions (proved)
- Block/receipt queries

### Data Received from Node
- Contract artifacts and instances
- Node info (chain ID, version)
- Transaction receipts
- Block data

### Security Assessment

| Control | Status | Notes |
|---------|--------|-------|
| TLS encryption | GOOD | Default endpoints use HTTPS |
| Node authentication | MISSING | No authentication of node responses |
| Privacy | CONCERN | All queries leak address-to-IP correlation |
| User-configurable | RISK | Users can point to malicious nodes |

### Findings

**[F-B5-01] MEDIUM - No Node Response Authentication**
- The wallet trusts node responses without cryptographic verification
- A malicious node could serve fake contract artifacts or incorrect state
- Impact: Could lead to incorrect balance display or failed transactions

**[F-B5-02] LOW - Address-to-IP Correlation**
- Every account query leaks the user's address to the node operator
- Stealth mode exists but doesn't prevent necessary node queries
- This is inherent to the architecture (Aztec aims to solve this at protocol level)

---

## Boundary 6: Background <-> WalletConnect Relay

### Transport
- WalletConnect v2 protocol over HTTPS
- End-to-end encrypted sessions
- Relay: `relay.walletconnect.com`
- **DISABLED by default** (`config.walletConnectEnabled = false`)

### Files
| Component | File | Key Lines |
|-----------|------|-----------|
| WC Service | `src/wallet/services/wallet-connect/service.ts` | 33-126 |

### Data Crossing
- Wallet metadata (name, icon, URL) — plaintext to relay
- Session proposals — encrypted
- Transaction requests — encrypted
- Session management events

### Security Assessment

| Control | Status | Notes |
|---------|--------|-------|
| Default disabled | GOOD | Opt-in via Settings > External Services |
| E2E encryption | GOOD | Session data encrypted end-to-end |
| Metadata privacy | PARTIAL | Wallet name/icon sent to relay in plaintext |
| Relay trust | MODERATE | Relay sees connection patterns but not content |

### Findings

**[F-B6-01] LOW - Metadata Leakage When Enabled**
- When WalletConnect is enabled, wallet metadata is sent to the relay
- Relay can correlate which dApps the user connects to
- Impact: Low — this is standard WalletConnect behavior, and it's opt-in

---

## Summary: Trust Boundary Risk Matrix

| Boundary | Risk | Key Concern |
|----------|------|-------------|
| 1: Page ↔ Content | **MEDIUM** | First-handshake-wins MITM, no server auth |
| 2: Content ↔ Background | **MEDIUM** | No per-connection auth, service name only |
| 3: Popup ↔ Background | **LOW** | Same as B2 but popup is trusted |
| 4: Background ↔ Offscreen | **LOW** | Secrets forwarded to PXE (necessary) |
| 5: Background ↔ Node | **MEDIUM** | No response auth, address-IP correlation |
| 6: Background ↔ WC Relay | **LOW** | Disabled by default, metadata leakage when on |
