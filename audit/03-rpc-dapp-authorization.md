# Phase 3: RPC & dApp Authorization Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 3 CRITICAL, 5 HIGH, 10 MEDIUM, 2 LOW

---

## CRITICAL FINDINGS

### F-P3-01: CRITICAL — Lock Deadlock Bug in addDappSession()

**File:** `src/wallet/services/dapp-session/service.ts:103-105`
```typescript
} finally {
    this.lock.enter();  // BUG: Should be this.lock.leave()
}
```

**Issue:** The `finally` block calls `lock.enter()` instead of `lock.leave()`. After the first successful call to `addDappSession()`:
1. Lock is entered in the try block
2. Finally block enters lock AGAIN instead of releasing it
3. All subsequent calls to any method using this lock hang forever
4. `getDappSessions()`, `deleteDappSession()`, `upgradeDappSession()` — all deadlock

**Impact:** After the first dApp connection, no further sessions can be created, updated, or deleted. This is a show-stopping bug that effectively breaks dApp connectivity after the first connection.

**Fix:** Change `this.lock.enter()` to `this.lock.leave()`.

---

### F-P3-02: CRITICAL — No dApp Origin Binding on Sessions

**File:** `src/wallet/services/dapp-session/spec.ts:16-24`
```typescript
export type DappSession = {
    id: string;
    profileId: string;
    dappMetadata: DappMetadata;
    permissions: DappPermissions[];
    accounts: string[];
    confirmationLevel: AccessLevel;
    expiry: number;
    // MISSING: origin, dappId, or any caller-binding field
};
```

**Issue:** Sessions are identified solely by their random ID. There is no binding to the dApp origin/URL that created the session. This means:
1. Any dApp that knows a session ID can use it
2. `getSession()` and `closeSession()` have no ownership checks
3. Session hijacking is possible if the ID is leaked

**Impact:** If a session ID is intercepted (e.g., from URL fragments, timing attacks, or a compromised dApp), any dApp can impersonate the session owner.

**Fix:** Add an `origin` field to `DappSession`. Track the content script origin on session creation. Validate origin on every session use.

---

### F-P3-03: CRITICAL — Contract Instance/Artifact Validation Completely Missing

**File:** `src/wallet/services/rpc/utils.ts:227-235`
```typescript
function parseRegisterContractRequest(data: any): RegisterContractRequest {
    return {
        kind: "register_contract",
        chain: parseChainProp(data, "chain"),
        address: parseStringProp(data, "address"),
        instance: data.instance, // TODO: implement validation
        artifact: data.artifact, // TODO: implement validation
    };
}
```

**Issue:** Both `instance` and `artifact` pass through without any validation. A malicious dApp can:
1. Register a fake contract instance with wrong class/address mapping
2. Register a fraudulent artifact that misrepresents function signatures
3. Cause the wallet to execute functions on the wrong contract
4. Potentially cause PXE crashes with malformed data

**Fix:** Validate instance structure (classId, address, salt, deployer, etc.) and artifact schema (functions, events, etc.).

---

## HIGH FINDINGS

### F-P3-04: HIGH — getSession() / closeSession() No Ownership Verification

**File:** `src/wallet/services/rpc/service.ts:66-82`
```typescript
private async getSession(id: string): Promise<[string, DappSessionInfo | null]> {
    try {
        const session = await this.dappSessions.getDappSession(id);
        return [session.id, this.sessionInfo(session)];
    } catch { return ["", null]; }
}

private async closeSession(id: string): Promise<[string, DappSessionInfo | null]> {
    try {
        const session = await this.dappSessions.deleteDappSession(id);
        return [session.id, this.sessionInfo(session)];
    } catch { return ["", null]; }
}
```

**Issue:** Any dApp can query or delete any other dApp's session by knowing/guessing the session ID. While 256-bit IDs make guessing infeasible, a leaked ID (via URL fragment, logging, etc.) enables cross-dApp session manipulation.

**Fix:** Add ownership verification (requires F-P3-02 origin binding first).

---

### F-P3-05: HIGH — Scope Validation Uses endsWith() (Partial Match)

**File:** `src/wallet/services/dapp-interaction/service.ts:294-300`
```typescript
private checkScopesPermissions(session: DappSession, scopes: AztecAddress[]) {
    for (const address of scopes.map(x => x.toString())) {
        if (!session.accounts.some(x => x.endsWith(address))) {
            throw new Error("Unauthorized scopes");
        }
    }
}
```

**Issue:** `endsWith()` matches partial addresses. A session authorized for `aztec:31337:0x123456789ABCDEF0` would also match a scope of `0xDEF0` (last 4 chars). This could grant access to operations on accounts the user didn't authorize.

**Fix:** Extract the address portion from the CAIP account and compare exactly:
```typescript
const authorizedAddress = caipAccount.split(":").pop()?.toLowerCase();
if (authorizedAddress === address.toLowerCase()) { /* match */ }
```

---

### F-P3-06: HIGH — Popup Flooding (No Concurrent Popup Limit)

**File:** `src/wallet/services/dapp-interaction/service.ts:137-144`
```typescript
chrome.windows.create({
    type: "popup",
    url: chrome.runtime.getURL(`src/popup/index.html#/windows/${type}?requestId=${interaction.id}`),
    height: 800,
    width: 400,
});
```

**Issue:** No check for existing open popups. A dApp can call `execute()` or `connect()` hundreds of times in parallel, creating hundreds of popup windows, freezing the user's desktop.

**Fix:** Track open popup count, limit to 1 concurrent popup. Queue additional requests.

---

### F-P3-07: HIGH — Interaction ID Only 32 Bits + No Auth on Resolve/Reject

**File:** `src/wallet/services/dapp-interaction/service.ts:115-117, 65-79`
```typescript
// Generation — 8 hex chars = 32 bits
do {
    id = getRandomHex(8);
} while (this.storage.has(id));

// Resolution — no caller verification
public async resolveInteraction(id: string, result: ConnectionResult | ExecutionResult): Promise<void> {
    const interactionRequest = this.storage.get(id);
    if (!interactionRequest) throw new Error("Invalid id");
    interactionRequest.resolve(result);
}
```

**Issue:** Combined vulnerability:
1. Interaction IDs have only 32 bits of entropy — brute-forceable (~4 billion possibilities)
2. `resolveInteraction()` and `rejectInteraction()` have no authorization check
3. Any code that guesses the ID can resolve with fake results or reject legitimate interactions

**Fix:** Increase to `getRandomHex(32)` (128 bits) and add requester tracking.

---

### F-P3-08: HIGH — parseOptionalProp() Passes Arbitrary Values

**File:** `src/wallet/services/rpc/utils.ts:648-654`
```typescript
function parseOptionalProp<T>(data: any, prop: string): T | undefined {
    const value = data[prop];
    if (value === undefined) return undefined;
    return value;  // NO TYPE VALIDATION
}
```

**Used for:**
- `fee: parseOptionalProp(data, "fee")` — fee objects pass unchecked
- `artifact: parseOptionalProp(data, "artifact")` — contract artifacts pass unchecked

**Fix:** Replace with type-specific validation for each usage.

---

## MEDIUM FINDINGS

### F-P3-09: MEDIUM — CAIP Account Address Not Validated

**File:** `src/wallet/services/rpc/utils.ts:552-564`
```typescript
const [namespace, chainId] = ss;
if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
    return value as CaipAccount;
}
```

**Issue:** The address portion (3rd element of CAIP-10) is not validated at all. Could be empty string, invalid hex, wrong length.

---

### F-P3-10: MEDIUM — ChainId Accepts Hex via Unary +

**File:** `src/wallet/services/rpc/utils.ts:558, 572, 585`
```typescript
Number.isSafeInteger(+chainId)
```

**Issue:** Unary `+` operator parses hex strings (`"0x10"` → 16). Use `parseInt(chainId, 10)` for strict decimal parsing.

---

### F-P3-11: MEDIUM — Array Bounds Not Validated

**File:** `src/wallet/services/rpc/utils.ts:544-550`

No validation of array length — empty arrays and extremely large arrays both pass.

---

### F-P3-12: MEDIUM — dApp Metadata XSS Potential

**File:** `src/wallet/services/rpc/utils.ts:61-80`

The `logo` field accepts any string — could be a `data:image/svg+xml` URI with XSS payload. The `url` field isn't validated as HTTPS.

---

### F-P3-13: MEDIUM — Session Expiry Unvalidated in upgradeDappSession()

**File:** `src/wallet/services/dapp-session/service.ts:133-156`
```typescript
const newSession = { ...oldSession, id: newSessionId, expiry: newExpiry };
```

**Issue:** `newExpiry` is not validated. Could be set to past (immediately expires) or far future (effectively permanent).

---

### F-P3-14: MEDIUM — Case-Sensitive Account Address Comparison

**File:** `src/wallet/services/dapp-interaction/service.ts:282-286`
```typescript
if (!session.accounts.includes(account)) {
    throw new Error("Unauthorized account");
}
```

**Issue:** String comparison is case-sensitive. `0xABC` and `0xabc` are treated as different accounts.

---

### F-P3-15: MEDIUM — No Rate Limiting Anywhere

**Issue:** No rate limiting on:
- RPC method invocations
- Session creation
- Silent execution
- Connection requests
- Popup window creation

A dApp can flood the wallet with requests, causing DoS.

---

### F-P3-16: MEDIUM — WalletConnect Session Topic Used as dApp Session ID

**File:** `src/wallet/services/wallet-connect/service.ts:249`
```typescript
await this.dappSessions.upgradeDappSession(dappSession.id, wcSession.topic, wcSession.expiry * 1000);
```

**Issue:** WC session topic becomes the dApp session ID. If the WC topic is leaked or guessable, the corresponding wallet session is compromised.

---

### F-P3-17: MEDIUM — WC Namespace Validation Missing

**File:** `src/wallet/services/wallet-connect/service.ts:212-217`

Namespace keys from WC proposals are used without validation. Non-Aztec namespaces could be processed.

---

### F-P3-18: MEDIUM — WC URI Not Validated Before Pairing

**File:** `src/wallet/services/wallet-connect/service.ts:190-198`
```typescript
await this.walletKit.pair({ uri });  // No format validation
```

---

## LOW FINDINGS

### F-P3-19: LOW — Version Number Leaked in getWalletInfo()

**File:** `src/wallet/services/rpc/types.ts:9`

Exposes exact wallet version to dApps. Could be used for fingerprinting or targeting known vulnerabilities.

---

### F-P3-20: LOW — Error Messages Reveal Parameter Names

**File:** `src/wallet/services/rpc/utils.ts:539, 546, 563, 577`
```typescript
throw new Error(`Invalid ${prop}`);
throw new Error("Invalid chain");
```

Helps attackers understand expected parameter structure.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| RPC method whitelist | Switch-case rejects unknown methods correctly |
| Session ID entropy | 256 bits via `getRandomHex(64)` + `crypto.getRandomValues` — strong |
| Connection always requires UI | `connect()` always opens popup — no silent connections |
| Permission model structure | Chains + methods + accounts per scope — granular |
| Profile lock check | Silent execution verifies active profile matches session |
| validateSession() | Checks account, method, and chain permissions per operation |
| deleteExpired() | Expired sessions cleaned on access — correct lazy cleanup |

---

## Critical Architectural Issues

### Issue A: No Request Origin Tracking
**Findings affected:** F-P3-02, F-P3-04, F-P3-07
**Root cause:** The RPC service has no way to identify which dApp/origin sent a request. Sessions are bearer tokens with no caller binding.
**Fix:** Propagate the content script tab/origin through the RPC chain and bind sessions to origins.

### Issue B: No Rate Limiting
**Findings affected:** F-P3-06, F-P3-15
**Root cause:** No throttling infrastructure exists.
**Fix:** Implement per-session token bucket rate limiter.

### Issue C: Insufficient Input Validation
**Findings affected:** F-P3-03, F-P3-08, F-P3-09, F-P3-10, F-P3-11, F-P3-12
**Root cause:** Many `parse*` functions validate type but not content.
**Fix:** Comprehensive input validation pass on all RPC parameter parsers.
