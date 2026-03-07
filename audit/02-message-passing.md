# Phase 2 — Message Passing

## F-P2-01: Content Script Pure Relay (INFO)

**File:** `src/content-script/content.ts:1-22`

The content script uses `@aztec/wallet-sdk ContentScriptConnectionHandler` as a pure relay. No private keys or secrets touch the content script. Messages flow:

```
dApp page ← postMessage/MessagePort → Content Script ← chrome.runtime.sendMessage → Service Worker
```

The wallet-sdk handles ECDH P-256 key exchange and AES-256-GCM encryption at the protocol layer. The content script never sees plaintext dApp↔wallet messages.

No issues found. This is a significant improvement over custom ECDH proxy implementations.

---

## F-P2-02: Port Name Validation (INFO)

**File:** `src/wallet/base/background/service.ts:40`

```typescript
private readonly onConnect = (client: chrome.runtime.Port) => {
    if (client.name !== this.name) {
        return;
    }
```

Each service validates that incoming port connections match the expected service name before processing messages. This prevents cross-service message injection within the extension.

No issues found.

---

## F-P2-03: Weak Request ID Entropy (HIGH)

See [F-P1-03](01-key-management-crypto.md#f-p1-03-mathrandom-for-request-ids-high). Shared finding — `Math.random()` used in both `background/client.ts` and `offscreen/client.ts` for request ID generation.

---

## F-P2-04: Offscreen Communication Hardening (LOW)

**File:** `src/wallet/base/offscreen/client.ts:10, 117-124`

Offscreen requests have a 90-second timeout (`REQUEST_TIMEOUT_MS`). Each client gets a unique UID via `getRandomHex(8)` (~32 bits entropy). Messages are routed by `message.to === this.uid`. Keepalive pings every 20 seconds prevent Chrome from killing the service worker.

**Minor issue:** The popup↔background channel (port-based) has no request timeout. A hung background service method will block the popup indefinitely.

**Recommendation:** Add a configurable timeout to `ServiceClient` (background/client.ts) request handling, similar to the offscreen client's 90s timeout.

---

## F-P2-05: JSON Sanitization — No Schema Validation (LOW)

**File:** `src/wallet/utils/serialization.ts:20-22`

```typescript
export function jsonSanitize(obj: any): any {
    return obj !== undefined ? JSON.parse(jsonStringify(obj)) : undefined;
}
```

The `jsonSanitize` function handles BigInt→string and Buffer→base64 conversion to prevent JSON.stringify errors. However, incoming messages from content scripts and dApps have **no schema validation**. Message structure is trusted implicitly.

**Impact:** Low. Messages are typed at the TypeScript level, but runtime validation is absent. A malformed message could trigger unexpected code paths.

**Recommendation:** Add lightweight runtime validation (e.g., Zod schemas) for messages crossing trust boundaries (content script → background, dApp → wallet-sdk handler).
