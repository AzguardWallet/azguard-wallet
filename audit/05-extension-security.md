# Phase 5: Content Script & Extension Security Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 0 CRITICAL, 2 HIGH, 10 MEDIUM, 2 LOW

---

## HIGH FINDINGS

### F-P5-01: HIGH — Content Script Injected Into All Pages

**File:** `manifest/manifest.config.ts:25-31`
```typescript
content_scripts: [
    {
        all_frames: true,
        js: ["src/content-script/content.ts"],
        matches: ["*://*/*"],
        run_at: "document_start",
    },
],
```

**Issue:** Content script is injected into **every page** on every protocol:
- `all_frames: true` — injects into all iframes, increasing attack surface
- `matches: ["*://*/*"]` — matches HTTP, HTTPS, and potentially other schemes
- `run_at: "document_start"` — executes before DOM parsing

**Impact:** Unnecessary injection on pages that will never interact with the wallet. Increases fingerprinting surface and attack exposure.

**Fix:**
```typescript
matches: ["https://*/*", "http://localhost/*"],
all_frames: false,
run_at: "document_idle",
```

---

### F-P5-02: HIGH — No Method Whitelist on Content Script Proxy

**File:** `src/content-script/proxy/server.ts:51-58`
```typescript
readonly #onInpageMessage = async (client: string, message: IProxyMessage) => {
    if (message.type != ProxyMessageType.Request) {
        return;
    }
    while (!this.#connected) {
        await sleep(300);
    }
    const { requestId, method, payload } = message as ProxyRequestMessage;
    let response;
    try {
        const result = await this.#service.invoke(method, payload);
```

**Issue:** The content script proxy accepts **any method name** from the page script and forwards it to the background service via `invoke(method, payload)`. No whitelist of allowed RPC methods. Also uses loose equality (`!=` instead of `!==`).

**Impact:** Page scripts can attempt to invoke any method exposed by the RPC service.

**Fix:** Add explicit method whitelist:
```typescript
const ALLOWED_METHODS = ['get_wallet_info', 'connect', 'execute', ...];
if (!ALLOWED_METHODS.includes(method)) return;
```

---

## MEDIUM FINDINGS

### F-P5-03: MEDIUM — No Port Sender Verification in Background Service

**File:** `src/wallet/base/background/service.ts:39-46`
```typescript
private readonly onConnect = (client: chrome.runtime.Port) => {
    if (client.name !== this.name) {
        return;
    }
    client.onDisconnect.addListener(this.onDisconnect);
    client.onMessage.addListener(this.onMessage);
    this.clients.push(client);
```

**Issue:** Port connections are accepted based solely on `client.name`. The `sender` property (containing tab ID, URL, extension ID) is not verified. Any extension context (or potentially other extensions in certain configurations) that knows the service name can connect.

**Fix:** Validate `client.sender?.url?.startsWith(chrome.runtime.getURL(''))`.

---

### F-P5-04: MEDIUM — Offscreen Document Accepts Messages Without Sender Check

**File:** `src/wallet/base/offscreen/service.ts:39-49`
```typescript
private readonly onMessageListener = (message: RequestMessage<TRequests>): boolean => {
    if (message.to === this.name) {
        this.onMessage(message);
    }
    return false;
};
```

**Issue:** Uses `chrome.runtime.onMessage` which receives messages from any extension context. Only validates `message.to` field, not the sender's identity. A compromised content script could directly invoke PXE methods by crafting messages with `to: "pxe"`.

**Fix:** Check `sender` parameter in the listener to verify messages come from the background service worker.

---

### F-P5-05: MEDIUM — CSP Missing Critical Directives

**File:** `manifest/manifest.config.ts:35-37`
```typescript
content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'",
},
```

**Issue:** (Extends F-P2-03) No `style-src`, `img-src`, `connect-src`, or `frame-ancestors` directives. `'wasm-unsafe-eval'` is required for Barretenberg but is the only exception needed.

**Fix:**
```
script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; connect-src https://devnet.aztec-registry.xyz https://testnet.aztec-registry.xyz; frame-ancestors 'none'; object-src 'none';
```

---

### F-P5-06: MEDIUM — ECDH Handshake State Allows Recovery After Block

**File:** `src/content-script/proxy/messenger/client .ts:117-147`

**Issue:** (Extends F-P2-05) After blocking (`this.#key = null`), the event listener removal and null check create a window where a new client could potentially bypass the block state. The triple-state encoding (`undefined`/`CryptoKey`/`null`) is fragile.

**Fix:** Use explicit state enum and ensure blocked state is permanent.

---

### F-P5-07: MEDIUM — No Rate Limiting on Proxy Requests

**File:** `src/content-script/proxy/server.ts:51-76`

**Issue:** No limit on concurrent requests from a single page. A dApp can flood the proxy with thousands of requests, each waiting in a while loop for connection, causing memory exhaustion.

**Fix:** Implement per-client token bucket rate limiter (max 100 requests/minute).

---

### F-P5-08: MEDIUM — Offscreen Document Startup Race Condition

**File:** `src/wallet/utils/offscreen.ts:25-50`
```typescript
export async function ensureOffscreenRunning() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl],
    });
    if (existingContexts.length > 0) return;

    if (!offscreenPromise) {
        offscreenPromise = new Promise((resolve, reject) => { ... });
        chrome.offscreen.createDocument({ ... });
    }
    await offscreenPromise;
}
```

**Issue:** Race condition between `getContexts()` check and `createDocument()`. Multiple callers could both attempt to create the offscreen document. No error handling for `createDocument()` failure. 5-second timeout is arbitrary.

**Fix:** Add mutex flag, error handling for creation failure, and exponential backoff.

---

### F-P5-09: MEDIUM — No Registry URL Path Traversal Prevention

**File:** `src/wallet/services/pxe/service.ts:382-416`
```typescript
private async fetchFromRegistry(network: Network, path: string): Promise<unknown | undefined> {
    const registryUrl = this.getRegistryUrl(network);
    if (!registryUrl) return undefined;
    const data = await fetch(`${registryUrl}${path}`);
    return await data.json();
}
```

**Issue:** `path` is concatenated directly to registryUrl without validation. No certificate pinning. Response is parsed as JSON without size limits.

**Fix:** Validate URL construction with `new URL(path, registryUrl)` and verify `url.origin === registryUrl.origin`.

---

### F-P5-10: MEDIUM — Popup Window Missing Clickjacking Protection

**File:** `src/wallet/services/dapp-interaction/service.ts:137-142`

**Issue:** Popup windows created without clickjacking protection. No `frame-ancestors 'none'` in CSP. User could be socially engineered to interact with malicious overlay.

**Fix:** Add `frame-ancestors 'none'` to CSP. Set `focused: true` on popup creation.

---

### F-P5-11: MEDIUM — Session-Client Map Memory Leak in Proxy Server

**File:** `src/content-script/proxy/server.ts:37-49`
```typescript
readonly #sessionClients: Map<string, string[]> = new Map();
```

**Issue:** Sessions are never removed from `#sessionClients`. Map grows unbounded as new sessions are created and old clients disconnect. Eventually causes memory exhaustion on long-running pages.

**Fix:** Implement TTL-based eviction or periodic cleanup.

---

### F-P5-12: MEDIUM — Event Handler Errors Silently Swallowed

**File:** `src/content-script/proxy/client.ts:73-76`
```typescript
for (const handler of handlers) {
    try {handler(payload)} catch {}
}
```

**Issue:** All event handler exceptions are silently swallowed. Bugs in handlers go completely unnoticed.

**Fix:** Add `console.error` in catch block.

---

## LOW FINDINGS

### F-P5-13: LOW — Popup HTML Missing Security Meta Tags

**File:** `src/popup/index.html`

**Issue:** Missing `<meta name="referrer" content="no-referrer">` and `<meta http-equiv="Content-Security-Policy">`. Same issue in offscreen HTML.

---

### F-P5-14: LOW — Offscreen HTML Missing Security Meta Tags

**File:** `src/offscreen/index.html`

Same as F-P5-13.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| No `eval()` or `new Function()` | Safe — no dynamic code execution |
| No `chrome.runtime.onMessageExternal` | Extension isolated from external extensions |
| No web accessible resources | Minimal fingerprinting surface |
| ECDH P-521 for page↔content script | Strong encryption for untrusted boundary |
| AES-256-GCM per-message | Authenticated encryption prevents tampering |
| `jsonSanitize()` | Strips non-serializable types before serialization |
| No innerHTML in content scripts | Safe from DOM-based XSS |
| Privacy-first defaults | stealthMode: true, externalLinks: "disabled" |
