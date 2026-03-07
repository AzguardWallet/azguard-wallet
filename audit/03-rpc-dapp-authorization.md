# Phase 3 — RPC & dApp Authorization

## F-P3-01: Empty Methods List Grants Blanket Access (HIGH)

**File:** `src/wallet/services/dapp-interaction/service.ts:324-331`

```typescript
private checkMethodPermission(session: DappSession, method: string, chain: string) {
    // Empty methods list means "all methods allowed" — authorization is
    // delegated to the requestCapabilities flow instead of connect-time permissions.
    const matchingChain = session.permissions.find(x => x.chains?.includes(chain));
    if (!matchingChain) {
        throw new Error("Unauthorized method/chain");
    }
}
```

The method check only validates chain membership. If `permissions[].methods` is empty or undefined, **all methods are allowed** on that chain. A dApp requesting `{ chains: ["aztec:1"], methods: [] }` gains access to every wallet-sdk method including `sendTx`, `registerContract`, and `getPrivateEvents`.

**Impact:** High. Users approving a dApp connection may not realize they're granting unrestricted access. The code comment indicates this is intentional ("delegated to requestCapabilities flow"), but the capability-request UI may not surface this clearly.

**Recommendation:**
1. Require non-empty `methods` array at session creation time, OR
2. Explicitly validate methods against `METHOD_TO_KIND` whitelist in `checkMethodPermission`, OR
3. Show a clear "full access" warning in the connection approval UI when methods list is empty

---

## F-P3-02: WalletSdkDispatcher Method Whitelist (INFO)

**File:** `src/wallet/services/wallet-sdk/dispatcher.ts:62-80`

The dispatcher maintains an explicit `METHOD_TO_KIND` map with 19 allowed methods. Unrecognized methods throw `"Unsupported wallet method"` (line 152). This is the correct pattern — no blanket method access at the dispatcher layer.

Note: The blanket access issue in F-P3-01 operates at the `DappInteractionService` layer, which is the legacy path used by `sendTx`. The dispatcher itself is secure.

---

## F-P3-03: 7-Day Session TTL Without Revocation Check (MEDIUM)

**File:** `src/wallet/services/dapp-session/service.ts:118`

```typescript
expiry: Date.now() + 7 * 24 * 60 * 60 * 1000,  // 7 days
```

Sessions expire after 7 days. During this window:
- Sessions auto-approve on reconnection (wallet-sdk/background.ts:199-223)
- No mechanism for user-initiated session revocation from the settings UI
- No session activity audit log

**Impact:** Medium. A compromised dApp retains wallet access for up to 7 days. If the user removes the dApp tab, the session persists and auto-approves when the dApp reconnects.

**Recommendation:**
1. Add session management UI (view active sessions, revoke individually)
2. Consider shorter default TTL (e.g., 24 hours) with optional "remember" checkbox
3. Log session activity for user review

---

## F-P3-04: No Schema Validation on DappPermissions (LOW)

**File:** `src/wallet/services/dapp-session/service.ts:94-130`

Session creation accepts `permissions: DappPermissions[]` directly from the caller without runtime validation. The `DappPermissions` type is:

```typescript
export type DappPermissions = {
    chains?: string[];
    methods?: string[];
    events?: string[];
};
```

All fields are optional. No validation ensures chains are valid Aztec chain IDs or methods are recognized wallet-sdk methods.

**Recommendation:** Add Zod or manual validation at `addDappSession()` to reject malformed permissions.

---

## F-P3-05: AccessLevel Model (INFO)

**File:** `src/wallet/services/dapp-session/spec.ts:35-42`

Six access levels from `None` (0) to `Transactions` (5) provide granular authorization. The `confirmationLevel` in each session controls which operations require user confirmation. This is well-designed.
