# Phase 8: Implementation Quality Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 0 CRITICAL, 0 HIGH, 14 MEDIUM, 12 LOW

---

## ERROR HANDLING

### F-P8-01: MEDIUM — Bare Empty Catch in Content Script Messenger

**File:** `src/content-script/proxy/messenger/client .ts:153`
```typescript
try {this.#onMessage(message)} catch {}
```

**Issue:** Silently swallows all errors from message handling, including critical type errors or exceptions.

**Fix:** Add `console.error` in catch block.

---

### F-P8-02: MEDIUM — Fire-and-Forget Async in Offscreen Service

**File:** `src/wallet/base/offscreen/service.ts:41`
```typescript
if (message.to === this.name) {
    this.onMessage(message); // async, no await, no .catch()
}
```

**Issue:** `onMessage()` is async but called without awaiting or error handling. Exceptions silently dropped.

**Fix:** Add `.catch(error => this.logError(...))`.

---

### F-P8-03: MEDIUM — Unsafe Type Assertion in WalletConnect Logger

**File:** `src/wallet/services/wallet-connect/service.ts:185`
```typescript
const target = keys.reduce((obj, key) => obj[key], core as any);
Object.assign(target, loggerConfig);
```

**Issue:** Uses `as any` bypass then mutates a dynamically-accessed object without validation. Silent configuration failures possible.

**Fix:** Add path validation with type checks.

---

## TYPE SAFETY

### F-P8-04: MEDIUM — 40+ RPC Parsing Functions Use `any` Parameters

**File:** `src/wallet/services/rpc/utils.ts`
```typescript
export function parseConnectionParams(data: any): ConnectionParams {
export function parseDappMetadata(data: any): DappMetadata {
export function parseEvent(data: any): string {
// ... 40+ more
```

**Issue:** All RPC parsing functions accept `any`, defeating TypeScript's compile-time type checking on the most critical attack surface (dApp→wallet message boundary).

**Fix:** Use Zod schemas or `unknown` with type guards for all RPC input parsing.

---

### F-P8-05: MEDIUM — Unsafe Non-Null Assertion on Array Access

**File:** `src/wallet/services/execution/service.ts:289`
```typescript
if (results.length && results.at(-1)!.status !== "ok") {
```

**Issue:** Non-null assertion (`!`) without checking that `.at(-1)` actually returned a value.

**Fix:** Use optional chaining: `results.at(-1)?.status !== "ok"`.

---

### F-P8-06: MEDIUM — Passkey Service Uses `as any` to Bypass Type Check

**File:** `src/wallet/services/passkey/service.ts:84`
```typescript
(chrome.windows.onRemoved.addListener as any)(onRemoved);
```

**Issue:** Type assertion hides potential type mismatch. Listener may not be properly removed if method signatures differ.

---

### F-P8-07: LOW — Passkey Service `send()` Accepts `any`

**File:** `src/wallet/services/passkey/service.ts:60`
```typescript
public async send(message: any) {
```

**Issue:** Should be properly typed to specific message types.

---

## CODE CONSISTENCY

### F-P8-08: MEDIUM — Inconsistent Lock Usage Across Services

**Issue:** Some services use Lock for critical sections, others don't despite having shared mutable state:

| Service | Has Lock | Has Shared Mutable State |
|---------|----------|--------------------------|
| ProfileService | Yes | Yes |
| ContactService | Yes | Yes |
| DappInteractionService | Yes | Yes |
| NetworkService | Yes | Yes |
| TokenService | **No** | Yes (tokens, storage) |
| AccountService | **No** | Yes (accounts, storage) |
| TokenBalanceService | **No** | Yes (worker, queue) |

**Fix:** Audit all services for shared mutable state and add locks where concurrent access is possible.

---

### F-P8-09: LOW — Inconsistent Promise Handling

**Issue:** Mixed `Promise.all()` vs `Promise.allSettled()` usage:
- `auth-registry/service.ts:177` — `Promise.all()` (fails on first error)
- `transaction/service.ts:188` — `Promise.allSettled()` (tolerates partial failure)

No consistent policy for which pattern to use where.

---

### F-P8-10: LOW — Commented-Out Dead Code

**File:** `src/wallet/services/network/service.ts:52-75`

**Issue:** 20+ lines of commented-out default network configurations for other devnet/testnet versions.

---

## TODO/FIXME CATALOG

### F-P8-11: MEDIUM — 11 Unaddressed TODOs in Critical Code

| Location | TODO | Impact |
|----------|------|--------|
| `rpc/utils.ts:232-233` | `TODO: implement validation` for contract instance/artifact | **CRITICAL** — arbitrary data passes through |
| `execution/service.ts:797` | `TODO: check on-chain class registration via node` | HIGH — fake contracts treated as valid |
| `execution/service.ts:818` | `TODO: check on-chain initialization via nullifier` | HIGH — uninitialized contracts treated as ready |
| `execution/service.ts:118` | `TODO: consider dynamic adjustment` for fee coefficient | MEDIUM — hardcoded fee multiplier |
| `execution/service.ts:842` | `TODO: filter by chainId` | MEDIUM — cross-chain data leakage |
| `execution/service.ts:1120` | `TODO: replace x2 multiplier` | MEDIUM — gas overestimation |
| `execution/models/fee.ts:30` | `TODO: add priority fee` | LOW — missing fee feature |
| `account/contracts/azguard-v0-base.ts:151` | `TODO: consider reusing ensureRegistered()` | LOW — code duplication |
| `fpc/service.ts:55` | `TODO: remove it` | LOW — dead code |
| `contact/spec.ts:29` | `TODO: add chainId` | LOW — missing multi-chain support |
| `transaction/service.ts:255` | `TODO: consider moving logic` | LOW — architectural improvement |
| `token-balance/service.ts:240` | `TODO: settings` for sync interval | LOW — hardcoded interval |

---

## TESTING COVERAGE

### F-P8-12: MEDIUM — Critical Code Paths Have No Test Coverage

**Test files found:** Only 4 test files in entire codebase:
- `src/wallet/utils/mnemonic.test.ts` (132 lines)
- `src/wallet/services/profile/encryption/encryption-key.test.ts` (39 lines)
- `src/wallet/services/task/__tests__/service.test.ts` (381 lines)
- `src/wallet/services/task/__tests__/client.test.ts`

**NOT tested (security-critical):**
- RPC parsing and validation functions (40+ functions, attack surface)
- ExecutionService (transaction construction, fee calculation, gas estimation)
- DappInteractionService (permission checks, scope validation)
- AccountService (derivation, registration)
- DappSessionService (session management, expiry)
- Content script messenger (ECDH handshake, encryption)
- ProfileService (authentication, session management)
- WalletConnect integration

**Impact:** No automated regression detection for security-critical code. Bugs in transaction construction, permission checks, or crypto could go undetected.

**Fix:** Prioritize tests for: RPC parsing, execution service, dApp permission checks.

---

## MEMORY MANAGEMENT

### F-P8-13: MEDIUM — DappInteraction Map Without Eviction

**File:** `src/wallet/services/dapp-interaction/service.ts:36`
```typescript
private readonly storage: Map<string, DappInteraction> = new Map();
```

**Issue:** Interactions stored without cleanup. If dApps open many interactions without user response, memory grows unbounded.

**Fix:** Add timeout-based cleanup (e.g., 5 minutes per interaction).

---

### F-P8-14: LOW — Log Buffer Large in Debug Mode

**File:** `src/wallet/logger/store.ts:14`
```typescript
this.logs = new CircularBufferIterable(this.logLevel === LogLevel.Debug ? 10_000 : 1000);
```

**Issue:** 10,000 log entries in debug mode. Each entry includes trimmed data objects. Could consume significant memory in long-running background.

---

## BUILD & CONFIGURATION

### F-P8-15: LOW — Verbose Logging Hardcoded for All Builds

**File:** `vite.config.ts:149`
```typescript
"process.env": JSON.stringify({
    LOG_LEVEL: "verbose",
    BB_WASM_PATH: "/assets/barretenberg.wasm.gz",
}),
```

**Issue:** `LOG_LEVEL: "verbose"` is hardcoded for all builds, not environment-specific. Verbose logging in production could leak sensitive information.

**Fix:** Use `process.env.VITE_LOG_LEVEL || "info"`.

---

### F-P8-16: LOW — No Explicit Source Map Exclusion in Production

**File:** `vite.config.ts`

**Issue:** No explicit `sourcemap: false` in production build configuration. Could inadvertently include source maps exposing source code.

**Fix:** Add `build: { sourcemap: false }` for production builds.

---

## LOGGING

### F-P8-17: LOW — Trimming Hides Important Failure Data

**File:** `src/wallet/logger/utils.ts:69-112`
```typescript
case "acir":
case "authWitnesses":
case "partialWitness":
    (acc as any)[k] = `[${k}]`;  // Replaced with placeholder
    break;
```

**Issue:** Large objects (contract artifacts, auth witnesses) completely replaced with placeholders in logs. If a witness fails, logs won't show what failed.

**Fix:** Log hash or byte-length of large objects instead of removing them entirely.

---

### F-P8-18: LOW — Limited Context Logging in Decision Paths

**Issue:** Some critical decision paths lack context logging:
- Why was a transaction skipped?
- Why did a permission check fail with a specific reason?
- Why was a contract/sender not registered?

Makes user-reported issues harder to debug.

---

## DEPENDENCIES

### F-P8-19: MEDIUM — All Aztec Dependencies on Unstable Devnet Version

**File:** `package.json`
```json
"@aztec/aztec.js": "4.0.0-devnet.2-patch.2",
"@aztec/pxe": "4.0.0-devnet.2-patch.2",
```

**Issue:** Pinned to `-patch.2` devnet version. Acceptable for devnet but represents unstable API surface. Updates may include breaking changes or critical fixes.

---

### F-P8-20: LOW — No Automated CVE Scanning

**Issue:** No `npm audit` script, no Dependabot/Renovate configuration, no Snyk integration visible.

**Fix:** Add `"audit": "npm audit --production"` to package.json scripts. Consider Dependabot for automated PRs.

---

## ASYNC PATTERNS

### F-P8-21: LOW — Async Callbacks May Not Propagate Errors

**File:** `src/wallet/services/wallet-connect/service.ts:78`
```typescript
this.configStore.onUpdate.add(this.onConfigUpdate); // async handler
```

**Issue:** If the EventHandler class doesn't await async callbacks, errors in `onConfigUpdate` (including WalletConnect cleanup) won't propagate.

---

## INPUT VALIDATION

### F-P8-22: LOW — No Max Length on String Parsing

**File:** `src/wallet/services/rpc/utils.ts`
```typescript
function parseStringProp(data: any, prop: string): string {
    const value = data[prop];
    if (typeof value !== "string") throw new Error(`Invalid ${prop}`);
    return value;  // Could be 1MB+ string
}
```

**Issue:** String inputs from dApps have no length limit. Very long strings could cause memory pressure.

**Fix:** Add `if (value.length > MAX_STRING_LENGTH) throw new Error(...)`.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| Structured logging | LoggerStore with circular buffer, level filtering, structured data |
| Consistent base classes | Service/ServiceClient pattern applied consistently across all 23 services |
| TypeScript strict mode | `tsconfig.json` uses strict mode — catches many common errors |
| Good use of PBKDF2 | 600k iterations where used — meets NIST 2023 recommendations |
| Consistent error utilities | `getErrorMessage()` used throughout for safe error extraction |
| Service lifecycle | Clean init/destroy pattern with dependency injection |
| ESLint/Biome configured | Code formatting and linting enforced |
| Privacy-first defaults | stealthMode, disabled external services — excellent default posture |

---

## Summary by Category

| Category | Findings | Severity Range |
|----------|----------|---------------|
| Error Handling | 3 | MEDIUM |
| Type Safety | 4 | MEDIUM–LOW |
| Code Consistency | 3 | MEDIUM–LOW |
| TODO/FIXME | 11 items in 1 finding | MEDIUM |
| Testing | 1 (systemic) | MEDIUM |
| Memory Management | 2 | MEDIUM–LOW |
| Build Configuration | 2 | LOW |
| Logging | 2 | LOW |
| Dependencies | 2 | MEDIUM–LOW |
| Async Patterns | 1 | LOW |
| Input Validation | 1 | LOW |
