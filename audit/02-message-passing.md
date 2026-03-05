# Phase 2: Message Passing & Trust Boundaries Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 3 CRITICAL, 4 HIGH, 8 MEDIUM, 1 LOW

---

## CRITICAL FINDINGS

### F-P2-01: CRITICAL — Math.random() for Request IDs (All 3 Communication Layers)

**Files:**
- `src/content-script/proxy/client.ts:50-52` (ProxyClient)
- `src/wallet/base/background/client.ts:131` (ServiceClient)
- `src/wallet/base/offscreen/client.ts:115` (OffscreenClient)

```typescript
// ProxyClient
let requestId;
do { requestId = Math.random() }
while (this.#requests.has(requestId));

// ServiceClient & OffscreenClient
let id;
do { id = 1 + Math.random(); }
while (this.requests.has(id));
```

**Issue:** All three communication layers use `Math.random()` for request IDs. Math.random() is a non-cryptographic PRNG with ~48-53 bits of entropy and predictable output. An attacker who can observe request IDs can predict future ones and forge responses.

**Impact:** Within the encrypted ECDH channel (boundary 1), this is harder to exploit. Within the extension's internal channels (boundaries 2-4), the risk is lower since those contexts are trusted.

**Fix:** Use `crypto.getRandomValues()` with integer IDs:
```typescript
const buf = new Uint32Array(1);
crypto.getRandomValues(buf);
let id = buf[0] >>> 0;
```

---

### F-P2-02: CRITICAL — No Request Timeout on Any RPC Client

**Files:**
- `src/content-script/proxy/client.ts:60`
- `src/wallet/base/background/client.ts:119`
- `src/wallet/base/offscreen/client.ts:103`

```typescript
// All three:
return promise;  // Never times out
```

**Issue:** If a response never arrives (server crash, network failure, malicious server), the promise hangs indefinitely. This causes:
1. Memory leaks (promises + callbacks stored forever)
2. UI blocking (popup hangs waiting for background)
3. DoS conditions (thousands of pending requests accumulate)

**Fix:** Add `Promise.race()` with a timeout:
```typescript
const timeoutMs = 30_000;
return Promise.race([
    requestPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
]);
```

---

### F-P2-03: CRITICAL — Missing CSP Restrictions in Manifest

**File:** `manifest/manifest.config.ts:35-36`
```typescript
content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
},
```

**Issue:** CSP is missing critical directives:
- No `default-src 'none'` — allows anything not explicitly restricted
- No `object-src 'none'` — plugins/flash could execute
- No `frame-src 'none'` — extension pages could be framed
- No `connect-src` — allows connections to any origin

**Fix:**
```
default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src https://v4-devnet-2.aztec-labs.com https://azguardwallet.io; object-src 'none'; frame-src 'none';
```

---

## HIGH FINDINGS

### F-P2-04: HIGH — Object.defineProperty Missing configurable: false

**File:** `src/content-script/utils.ts:1-11`
```typescript
export function inject(prop: string, value: any) {
    try { delete (window as any)[prop]; } catch {}
    try {
        Object.defineProperty(window, prop, { value, writable: false });
        // Missing: configurable: false!
    } catch {}
    try { (window as any)[prop] = value; } catch {}
}
```

**Issue:** Without `configurable: false`, a page script can call `Object.defineProperty(window, 'azguard', ...)` and redefine the property with a malicious proxy that intercepts all wallet interactions.

**Fix:** Add `configurable: false, enumerable: false` and remove the fallback assignment:
```typescript
Object.defineProperty(window, prop, { value, writable: false, configurable: false, enumerable: false });
```

---

### F-P2-05: HIGH — ECDH Handshake State Machine Fragility

**File:** `src/content-script/proxy/messenger/client .ts:117-146`
```typescript
if (this.#key) {
    // MITM protection — second handshake blocks client
    console.warn("Suspicious handshake received...");
    window.removeEventListener("message", this.#processMessageEvent);
    this.#key = null;
    return;
}
if (this.#key === null) {
    // Client permanently blocked
    return;
}
```

**Issue:** The MITM detection uses three states encoded as `undefined`/`CryptoKey`/`null`, which is fragile:
- `undefined` = not yet handshaked
- `CryptoKey` = handshake complete
- `null` = permanently blocked

This triple-state via type overloading is error-prone and hard to reason about.

**Fix:** Use explicit state enum: `PENDING`, `CONNECTED`, `BLOCKED`.

---

### F-P2-06: HIGH — JSON.parse Without try-catch in Contact Import

**File:** `src/wallet/services/contact/service.ts:190`
```typescript
const importedContacts = JSON.parse(data)  // No try-catch!
    .map((c: importedContact) => ({...}))
    .filter(...)
```

**Issue:** User-supplied JSON is parsed without error handling. Malformed input crashes the import flow and potentially exposes internal error state.

**Fix:** Wrap in try-catch with proper error message.

---

### F-P2-07: HIGH — No Validation of Service Name in Offscreen

**File:** `src/wallet/base/offscreen/service.ts:39-44`
```typescript
private readonly onMessageListener = (message: RequestMessage<TRequests>): boolean => {
    if (message.to === this.name) {
        this.onMessage(message);
    }
    return false;
};
```

**Issue:** Uses `chrome.runtime.onMessage`, which receives messages from ANY extension context. A compromised content script could directly invoke PXE methods by crafting messages with `to: "pxe"`.

**Fix:** Validate sender context (check for `sender.url` being the offscreen document URL or service worker origin).

---

## MEDIUM FINDINGS

### F-P2-08: MEDIUM — Offscreen Client UID Too Short

**File:** `src/wallet/base/offscreen/client.ts:18-19`
```typescript
this.uid = getRandomHex(8);  // 8 hex chars = 32 bits
```

**Issue:** 32 bits of entropy for routing responses. Can be brute-forced in parallel.

**Fix:** Increase to `getRandomHex(32)` (128 bits).

---

### F-P2-09: MEDIUM — Event Message Routing Spoofable

**File:** `src/wallet/base/offscreen/client.ts:43-50`
```typescript
if (
    message.to === this.uid ||
    (message.type === MessageType.Event && message.from === this.service && message.to === undefined)
) {
    this.onMessage(message);
}
```

**Issue:** Events with `from === this.service` and `to === undefined` are accepted without authentication. A malicious script that can call `chrome.runtime.sendMessage` can forge events.

---

### F-P2-10: MEDIUM — Multiple Inpage Injection Race Condition

**File:** `src/content-script/inpage.ts:10-12`
```typescript
inject(azguardProp, azguardObject);
window.addEventListener("load", () => inject(azguardProp, azguardObject));
document.addEventListener("DOMContentLoaded", () => inject(azguardProp, azguardObject));
document.addEventListener("readystatechange", () => inject(azguardProp, azguardObject));
```

**Issue:** `inject()` is called 4 times. Between injections, page scripts have windows to override the object (especially if `configurable: false` is missing — see F-P2-04).

---

### F-P2-11: MEDIUM — Request ID Validation Insufficient

**File:** `src/wallet/base/background/service.ts:66-70`
```typescript
if (!requestId || !(method in this.requests) || typeof wrappedParams !== "object") {
```

**Issue:** `!requestId` is falsy for `0`, but request IDs are `1 + Math.random()` (1.0–2.0), so `0` is never generated. However, requestId is a float, and validation should check for integer type.

---

### F-P2-12: MEDIUM — JSON.parse in Decrypt Without Wrapper

**File:** `src/content-script/proxy/messenger/utils.ts:73-81`
```typescript
return JSON.parse(new TextDecoder().decode(
    await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct)
)) as T;
```

**Issue:** If decryption succeeds but produces invalid JSON (shouldn't happen with GCM auth, but defense in depth), the error is unhandled.

---

### F-P2-13: MEDIUM — Metadata Leakage in Encrypted Channel

**Issue:** While payloads are encrypted, message metadata (requestId sequence, message sizes, timing) is visible to page scripts. An attacker can infer which RPC method is being called by response timing and size patterns.

---

### F-P2-14: MEDIUM — Promise Rejection on Disconnect Not Error-Handled

**File:** `src/wallet/base/background/client.ts:49-64`

When `disconnect()` is called, all pending promises are rejected. If any reject callback throws, the error is swallowed silently.

---

### F-P2-15: LOW — Port Disconnection Cleanup

**File:** `src/wallet/base/background/service.ts`

When a port disconnects, the service removes it from `this.clients`. However, any pending events targeted at that client are silently dropped, which is correct behavior but should be logged.

---

## Cross-Cutting Findings

| Check | Result |
|-------|--------|
| `eval()` / `Function()` usage | NONE FOUND — safe |
| `chrome.runtime.onMessageExternal` | NOT USED — extension is isolated |
| Prototype pollution (`__proto__`, `constructor`) | NO VECTORS FOUND |
| `jsonSanitize()` | Strips non-serializable types correctly |

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| ECDH P-521 key exchange | Strong curve, proper key agreement |
| AES-256-GCM per-message encryption | Correct IV, authenticated |
| Per-client key isolation | Compromise of one client doesn't affect others |
| MITM detection (first-handshake-wins) | Functional, though fragile |
| Port name filtering | Prevents accidental cross-service connections |
| jsonSanitize() | Removes functions, prototypes before serialization |
| Error message sanitization | Only error strings sent, no stack traces |
