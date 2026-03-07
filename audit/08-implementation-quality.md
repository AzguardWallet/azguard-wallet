# Phase 8 — Implementation Quality

## F-P8-01: Unused Insecure getRandomElement() (LOW)

**File:** `src/wallet/utils/random.ts:5-10`

```typescript
export const getRandomElement = (arr: any[]) => {
    if (!arr.length) return undefined
    const index = Math.floor(Math.random() * arr.length)
    return arr[index]
}
```

Uses `Math.random()` for array element selection. Currently unused in the codebase (no callers found), but if used for security-sensitive selection in the future, it would be vulnerable.

**Recommendation:** Either remove the unused function or replace `Math.random()` with `crypto.getRandomValues` for consistency.

---

## F-P8-02: Silent Error Swallowing in Decrypt Queue (LOW)

**File:** `src/wallet/services/wallet-sdk/background.ts:141, 159`

```typescript
sessionQueues.set(key, next.catch(() => {}));
decryptQueues.set(sessionId, next.catch(() => {}));
```

The queue serializer for wallet-sdk session messages and decryption swallows errors silently. If a session handler or decryption operation fails, the error is discarded with no logging.

**Impact:** Low. These are fire-and-forget queue entries for serialization. However, a persistent decryption failure would be invisible to debugging.

**Recommendation:** Add error logging:
```typescript
decryptQueues.set(sessionId, next.catch((err) => {
    logger.log("wallet-sdk", LogLevel.Error, `Decryption failed: ${err.message}`);
}));
```

---

## F-P8-03: Monkey-Patch Fragility (LOW)

**File:** `src/wallet/services/wallet-sdk/background.ts:154`

```typescript
const origDecrypt = (handler as any).handleEncryptedMessage.bind(handler);
```

The wallet-sdk session handler's `handleEncryptedMessage` is monkey-patched to serialize concurrent decryptions. This relies on the internal method name remaining stable across `@aztec/wallet-sdk` versions. A refactor in the SDK would silently break this with no compile-time error.

**Impact:** Low. Would cause a runtime crash or bypass serialization, leading to the AES-GCM nonce ordering issue that the patch was designed to fix.

**Recommendation:** Open an issue / PR upstream to add a decryption hook or queue support to the wallet-sdk. Document the monkey-patch with the SDK version it targets.

---

## F-P8-04: `as any` Usage in Dispatcher (LOW)

**File:** `src/wallet/services/wallet-sdk/dispatcher.ts:136, 142, 260, 267, 427-473`

The dispatcher casts incoming `args: unknown[]` to specific types via `as any` at each method handler. This is pragmatic for a protocol bridge receiving dynamic messages, and each handler validates the structure before use.

**Impact:** Low. Type safety is maintained by the `METHOD_TO_KIND` whitelist and per-handler validation. The `as any` casts are localized to the parameter unpacking layer.

**Note:** Other `as any` usages in `passkey/service.ts:74,84` (Chrome API type workaround) and `logger/utils.ts:102,105` (dynamic key assignment) are justified.

---

## F-P8-05: No Popup↔Background Request Timeout (MEDIUM)

**File:** `src/wallet/base/background/client.ts`

Unlike the offscreen client (90s timeout), the popup→background `ServiceClient` has no request timeout. A hung service method blocks the popup indefinitely with no user feedback.

**Impact:** Medium. Users see a frozen UI with no way to recover except closing and reopening the popup.

**Recommendation:** Add a configurable timeout (e.g., 30s for UI operations, 120s for transaction operations) with a user-visible error state.

---

## F-P8-06: Async Correctness (INFO)

No widespread unhandled promise issues found. The codebase generally uses `await` correctly. Fire-and-forget patterns (keepalive pings, offscreen close) are appropriately `.catch(() => {})` guarded with comments explaining the rationale.
