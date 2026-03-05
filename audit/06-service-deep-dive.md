# Phase 6 — Service Deep Dive

## F-P6-01: Lock Force-Release Race Condition (HIGH)

**File:** `src/wallet/utils/lock.ts:37-44`

```typescript
this.forceReleaseTimer = setTimeout(() => {
    if (this.locked) {
        this.logger?.log(this.name!, LogLevel.Error,
            `Lock: force-released after ${MAX_HOLD_MS}ms (holder did not call leave)`);
        this.leave();
    }
}, MAX_HOLD_MS);  // 5 minutes
```

When a lock holder exceeds 5 minutes, the lock is force-released and the next waiter acquires it. However, the original holder's async operation **continues running** — no exception is thrown to it. This creates a window where two concurrent operations both believe they hold the lock.

**Impact:** High. The lock protects FPC mutations (`fpc/service.ts`), PXE registration, and storage writes. Concurrent holders can cause:
- Duplicate storage writes (data corruption)
- Race conditions in contract registration
- Inconsistent state between PXE and storage

**Recommendation:**
1. Return an `AbortSignal` from `lock.enter()` that the holder checks periodically
2. Or wrap the force-release with a "poisoned lock" flag that causes subsequent storage operations to throw
3. At minimum, log the force-release as a CRITICAL error with stack trace

---

## F-P6-02: Token Balance Worker — No Backoff on Failure (MEDIUM)

**File:** `src/wallet/services/token-balance/service.ts:227-262`

```typescript
private async startWorker() {
    while (true) {
        if (this.profile) {
            try {
                if (this.queue.length) {
                    // ... sync logic
                }
            } catch (error) {
                this.logError("Failed to sync token balances.", getErrorMessage(error));
            }
        }
        await sleep(1000);
    }
}
```

The worker loops every 1 second. On failure, it logs the error and retries immediately on the next iteration. No exponential backoff, no circuit breaker, no max retry count.

**Impact:** Medium. If the PXE or network is down, this generates ~60 error log entries per minute and keeps the CPU busy with failing requests.

**Recommendation:** Add exponential backoff (e.g., 1s → 2s → 4s → ... → 60s max) on consecutive failures. Reset backoff on success.

---

## F-P6-03: Task Map Cleanup (INFO)

**File:** `src/wallet/services/task/service.ts:223-240`

Tasks are properly cleaned up:
- Finished tasks retained for 5 minutes (`TASK_RETENTION_PERIOD_MS`), then deleted
- `deleteTaskTree()` recursively removes subtasks
- Profile switch clears all profile tasks

No memory leak risk identified. The previous audit flagged this as a concern, but the retention + cleanup logic is sound.

---

## F-P6-04: Unsafe ABI Decode Fallback (LOW)

**File:** `src/wallet/services/execution/service.ts:559-561`

```typescript
} catch (error) {
    this.logError("Failed to decode simulation results", fn.returnTypes, result, getErrorMessage(error));
    return result as any;
}
```

When ABI decoding of simulation results fails, the raw result is returned with `as any`. Callers expect decoded types — receiving raw data could cause downstream type confusion.

**Impact:** Low. This only fires when the contract ABI doesn't match the actual return data, which indicates a contract mismatch (not an attack). The error is logged.

**Recommendation:** Return a typed error object instead of raw data, or throw so callers can handle the failure explicitly.

---

## F-P6-05: FPC Discovery Double-Check Race (LOW)

**File:** `src/wallet/services/fpc/service.ts:56-124`

The "no FPCs cached?" check happens before lock acquisition. Two concurrent callers can both enter the discovery path, with the second re-discovering FPCs that the first already found.

**Impact:** Low. Duplicate work only — results are idempotent. The lock prevents concurrent storage writes.

**Recommendation:** Re-check cache after acquiring the lock (double-checked locking pattern).
