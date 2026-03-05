# Phase 6: Service-by-Service Deep Dive

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 0 CRITICAL, 2 HIGH, 9 MEDIUM, 4 LOW

---

## HIGH FINDINGS

### F-P6-01: HIGH — Incomplete On-Chain Validation of Contract Metadata

**File:** `src/wallet/services/execution/service.ts:797-820`
```typescript
// TODO: check on-chain class registration via node — pxeService.getContractArtifact
// falls back to known artifacts and contract registry, which doesn't mean on-chain registration
isContractClassPubliclyRegistered: !!artifact,

// TODO: check on-chain initialization via nullifier inclusion — pxeService.getContractInstance
// falls back to known instances and contract registry, which doesn't prove on-chain initialization
isContractInitialized: !!instance,
```

**Issue:** The wallet reports contracts as registered/initialized based on local artifact/registry presence, not actual on-chain state. A dApp could register a fake local artifact and the wallet would treat it as valid.

**Fix:** Implement on-chain validation via node RPC calls (`getContractClass`, nullifier inclusion proof).

---

### F-P6-02: HIGH — Missing Bounds Checking on Gas Estimates

**File:** `src/wallet/services/execution/service.ts:1111-1130`
```typescript
const gasPadding = op.fee?.gasPadding ?? 1.05;
// ...
simulatedTx.gasUsed.totalGas.mul(gasPadding) // No max limit enforced
```

**Issue:** `gasPadding` comes from the dApp with no upper bound. A dApp could specify `gasPadding: 1000` to cause the user to massively overpay for gas without it being visible in the confirmation UI.

**Fix:** Validate `gasPadding` is within `[1.0, 2.0]` range. Reject values outside bounds.

---

## MEDIUM FINDINGS

### F-P6-03: MEDIUM — Profile Lock Not Held During Silent Execution

**File:** `src/wallet/services/dapp-interaction/service.ts:147-223`
```typescript
private async silentInteraction(payload: ExecutionPayload): Promise<ExecutionResult> {
    const profile = await this.profileService.getActiveProfile();
    if (profile?.id !== payload.session.profileId) {
        throw new Error("Wallet locked");
    }
    // ... long async operations without lock ...
    return await this.executionService.executeOperations(operations, {...});
}
```

**Issue:** Profile is checked once at the start but no lock is held. The wallet could be locked between the check and execution, causing operations to proceed in an inconsistent state.

**Fix:** Re-validate profile immediately before execution, or hold profile lock for the duration.

---

### F-P6-04: MEDIUM — Session TTL Not Re-Validated During Operations

**File:** `src/wallet/services/profile/service.ts:50-71`
```typescript
protected async init(services: ServiceCollection) {
    const session = await this.session.get();
    if (session) {
        if (session.since + this.sessionTtl <= Date.now() && this.sessionTtl !== 0) {
            await this._closeSession();
            return;
        }
    }
}
// No re-check in getActiveProfile() or other operations
```

**Issue:** Session TTL is checked at service initialization but not re-validated during operations. Long-running operations continue executing after TTL expires.

**Fix:** Add TTL check in `getActiveProfile()` and critical operations.

---

### F-P6-05: MEDIUM — Token Balance Worker Silent Death

**File:** `src/wallet/services/token-balance/service.ts:227-280`
```typescript
private async startWorker() {
    while (true) {
        if (this.profile) {
            try {
                // ... queue processing ...
            } catch (error) {
                this.logError("...");
                await sleep(5000);
            }
        }
        await sleep(1000);
    }
}
```

**Issue:** If an unhandled exception occurs before the try block (e.g., in the `this.profile` accessor), the worker silently terminates. Balance updates stop without user notification.

**Fix:** Add outer try-catch with restart mechanism.

---

### F-P6-06: MEDIUM — FPC Discovery Race Condition

**File:** `src/wallet/services/fpc/service.ts:46-126`
```typescript
public async getFpcs(chainId?: number): Promise<FpcInfo[]> {
    const result = (await this.storage.getValues()).filter(
        fpc => fpc.profileId === profile.id && (chainId === undefined || fpc.chainId === chainId),
    );
    if (!result.length && chainId !== undefined) {
        this.logInfo("Discovering FPCs...");
        try {
            await this.lock.enter(); // Lock acquired AFTER the filter
            // ...modification...
        }
    }
}
```

**Issue:** Lock is acquired after the empty-check. Between the filter and lock, another thread could add FPCs, causing duplicate discovery.

**Fix:** Move `lock.enter()` before storage access.

---

### F-P6-07: MEDIUM — Hardcoded Single FPC Address Discovery

**File:** `src/wallet/services/fpc/service.ts:46-125`
```typescript
const sponsoredFpc = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
    constructorArgs: [],
    salt: Fr.zero(),
});

for (const contract of [sponsoredFpc.address]) { // Single hardcoded address
    // ...discovery logic
}
```

**Issue:** Only one FPC is ever discovered, using hardcoded parameters (`salt: Fr.zero()`). If the FPC contract parameters change, discovery fails silently.

**Fix:** Support dynamic FPC discovery or explicit configuration with multiple FPC addresses.

---

### F-P6-08: MEDIUM — Fee Payload Mutation Risk in Execution

**File:** `src/wallet/services/execution/service.ts:1200-1250`
```typescript
op.actions.unshift(...fpc.getFeePayload(...)); // First estimation
// ... simulation ...
op.actions.splice(0, op.actions.length, ...fpc.getFeePayload(...), ...originalActions); // Mutation
```

**Issue:** FPC fee payload is mutated in-place with splice operations. If `getFeePayload()` produces non-deterministic results or the splice fails partially, the transaction could execute with incorrect actions.

**Fix:** Create new action arrays instead of mutating; validate action list before submission.

---

### F-P6-09: MEDIUM — Contact Input Validation Insufficient

**File:** `src/wallet/services/contact/service.ts:76-100`
```typescript
public async addContact(name: string, address: string, color?: string): Promise<Contact> {
    const contact: Contact = {
        id,
        profileId: profile.id,
        name,      // ← no length validation
        address,   // ← only format checked at use time
        abbr: this._getAbbreviation(name),
        color: _color,
    };
}
```

**Issue:** Contact name has no length limit (could be thousands of chars). Address format not validated before storage. Could fill storage with garbage data or DOS the UI.

**Fix:** Add length limits and address format validation.

---

### F-P6-10: MEDIUM — No Stale Node Detection

**File:** `src/wallet/services/network/service.ts:22-40`
```typescript
private readonly nodes = new Map<number, AztecNode>();

public async getNode(chainId: number): Promise<AztecNode> {
    let node = this.nodes.get(chainId);
    if (!node) {
        node = createAztecNodeClient(network.rpcUrl);
        this.nodes.set(chainId, node);
    }
    return node; // Could be stale/disconnected
}
```

**Issue:** Nodes are cached indefinitely with no health checks. If a node goes offline after caching, operations fail with no retry or reconnection logic.

**Fix:** Add periodic health checks and re-create nodes on failure.

---

### F-P6-11: MEDIUM — Task Service Memory Leak

**File:** `src/wallet/services/task/service.ts:110-170`

**Issue:** `cleanupStaleTasks()` is defined but only called reactively after operations, not scheduled periodically. Long-lived service instances accumulate completed tasks in memory.

**Fix:** Schedule periodic cleanup (every 5 minutes) or implement TTL-based eviction.

---

## LOW FINDINGS

### F-P6-12: LOW — Account State Allows Arbitrary Sender Registration

**File:** `src/wallet/services/account-state/service.ts:34-94`
```typescript
public async addSender(networkId: string, address: string): Promise<string> {
    const sender = (await this.pxeService.registerSender(network, AztecAddress.fromString(address))).toString();
    this.emit("onSenderAdded", sender);
    return sender;
    // No check that address matches an owned account
}
```

**Issue:** Any address can be registered as a sender. Operations using non-owned addresses would fail on-chain but waste gas.

---

### F-P6-13: LOW — Execution Error Messages May Leak Internals

**File:** `src/wallet/services/execution/service.ts:388-391`
```typescript
} catch (error) {
    operationTask.fail(error);
    results.push({ status: "failed", error: getErrorMessage(error) });
}
```

**Issue:** Error messages from failed operations are passed to dApps without sanitization. May leak contract addresses, internal stack traces, or state information.

---

### F-P6-14: LOW — Session Expiry Check Not Atomic

**File:** `src/wallet/services/dapp-session/service.ts:46-60`
```typescript
public async getDappSession(sessionId: string): Promise<DappSession> {
    const session = await this.storage.get(sessionId);
    if (!session) throw new Error("Invalid id");
    if (await this.isExpired(session)) throw new Error("Session expired");
    return session;  // Could expire between check and use
}
```

**Issue:** Session could expire between the check and the caller's use of the returned session. Minimal practical risk due to short time window.

---

### F-P6-15: LOW — No Periodic Cleanup of Stale Network Connections

**Issue:** `NetworkService` caches `AztecNode` instances indefinitely. Combined with F-P6-10, stale connections accumulate without cleanup.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| Lock management | Consistent try-finally pattern in ProfileService, ContactService, TokenService, DappInteractionService, FpcService |
| Authorization checks | Consistent `getActiveProfile()` checks before operations across all services |
| Input validation (PXE) | Schema validation with Zod on critical PXE inputs |
| Error logging | All services use structured `getErrorMessage(error)` for logging |
| Event cleanup | WalletConnectService properly unsubscribes event listeners |
| 13 of 23 services pass | account, auth-registry, config, log-viewer, logger, note, pxe, token, transaction, wallet-connect — no new findings |

---

## Service Risk Summary

| Service | Findings | Risk Level |
|---------|----------|------------|
| execution | F-P6-01, F-P6-02, F-P6-08, F-P6-13 | HIGH |
| dapp-interaction | F-P6-03 | MEDIUM |
| fpc | F-P6-06, F-P6-07 | MEDIUM |
| profile | F-P6-04 | MEDIUM |
| token-balance | F-P6-05 | MEDIUM |
| contact | F-P6-09 | MEDIUM |
| network | F-P6-10, F-P6-15 | MEDIUM |
| task | F-P6-11 | LOW |
| account-state | F-P6-12 | LOW |
| dapp-session | F-P6-14 | LOW |
| **13 other services** | None | PASSING |
