# Vibeguard Wallet — Code Audit

Audit date: 2026-04-06
Auditors: Claude Opus 4.6, Claude Sonnet 4.6 (3 independent passes, consolidated)
All findings verified against source code.

## Status Legend

- [ ] Not started
- [x] Fixed
- [-] Won't fix (with reason)

---

## CRITICAL

### A1. Passhash stored in session storage (plaintext-equivalent secret)
- **File:** `src/wallet/services/profile/service.ts:569`
- **Issue:** SHA-256(password) stored in `chrome.storage.session` as base64. This hash is the sole input to `EncryptionKey.fromPasshash()` which derives the AES key via PBKDF2. Anyone with session storage access can reconstruct the encryption key without knowing the password.
- **Impact:** Full secret key compromise if session storage is accessed (other extensions, memory dump, devtools)
- **Fix:** Don't persist the passhash. Re-derive on each unlock, or use a session-scoped derived key that can't reconstruct the master.
- [ ] Not started

### A2. `exportEncrypted()` requires no authentication
- **File:** `src/wallet/services/profile/service.ts:422-432`
- **Issue:** Returns the encrypted master secret with zero auth checks (no password, no session, no active profile check). Combined with A1, an attacker gets everything needed to decrypt.
- **Impact:** Encrypted secret accessible to any code path that can call the service. Defense-in-depth gap.
- **Note:** Only callable from extension pages, not dApps. Still concerning.
- **Fix:** Add `confirmProfileOperation()` check (same as `exportPlain` uses).
- [ ] Not started

### A3. 29 `console.error("[DEBUG]...")` calls shipping sensitive data
- **Files:** `execution/service.ts` (23), `dispatcher.ts` (3), `fpc/service.ts` (3)
- **Issue:** Raw `console.error` calls log tx payloads, addresses, scope arrays, contract hashes. Visible in DevTools. For a privacy-first wallet, this is a data leak. Internal logger (`this.logDebug`) exists but isn't used.
- **Impact:** PII and transaction metadata exposed to anyone inspecting the extension.
- **Fix:** Replace all with `this.logDebug()` / `this.logError()`, or remove entirely.
- [ ] Not started

---

## HIGH

### A4. `register_contract` RPC handler skips input validation
- **File:** `src/wallet/services/rpc/utils.ts:196-197`
- **Issue:** `instance` and `artifact` from untrusted dApp data passed directly with `// TODO: implement validation`. Zod schemas exist in the codebase but aren't applied.
- **Fix:** Apply `ContractInstanceWithAddressSchema` and `ContractArtifactSchema`.
- [ ] Not started

### A5. Port null dereference race
- **File:** `src/wallet/base/background/client.ts:122`
- **Issue:** `port!.postMessage(request)` after async sleep-loop. `onDisconnect` can fire between state check and call, setting `port = undefined`.
- **Fix:** Guard with `if (!this.port)` inside the loop, reconnect if needed.
- [ ] Not started

### A6. Near-zero test coverage on critical paths
- **Files:** 6 test files / 55 tests total
- **Issue:** Zero tests for ExecutionService (1800+ lines), WalletSdkDispatcher, AccountService, ProfileService, PxeService, all Pinia stores. Architecture couples to Chrome APIs via `ServiceCollection.get()` (string lookup), making DI/mocking very hard.
- **Fix:** Long-term DI refactor + incremental test addition. See testability section below.
- [ ] Not started

### A7. Popup bypasses service layer with direct `chrome.storage` calls
- **Files:** 12 popup files use `chrome.storage.local.get/set/remove` directly
- **Affected:** `app.vue`, `auth.vue`, `BalanceView.vue`, `FeeSettingsCard.vue`, `NetworksPopup.vue`, `NewAccountPopup.vue`, `NewNetworkPopup.vue`, `RegisterPopup.vue`, `ResetPopup.vue`, `fpcs/index.vue`, `networks/index.vue`, `advanced/index.vue`
- **Issue:** Hardcoded string keys like `"vibeguard:ui:activeNetwork"` bypass `EntityStorage`/`ValueStorage`. A key rename in the service layer silently breaks the popup.
- **Fix:** Consolidate into a `UIStateService` or extend `ConfigService`.
- [ ] Not started

### A8. Capability manifest typed as `any`
- **File:** `src/wallet/services/wallet-sdk/dispatcher.ts:297`
- **Issue:** `handleRequestCapabilities(manifest: any, ...)` — most security-critical input has no schema validation. `requestedCapabilities: any[]` extracted without type safety.
- **Fix:** Define and apply Zod schema for capability manifest.
- [ ] Not started

---

## MEDIUM

### A9. `fetchInstanceFromRegistry` is dead code
- **File:** `src/wallet/services/pxe/service.ts:461-476`
- **Issue:** Body is `return undefined;` with real implementation commented out.
- **Fix:** Remove dead code or implement properly.
- [ ] Not started

### A10. `EntityStorage.getValues()` loads entire storage namespace
- **File:** `src/wallet/storage/entity_storage.ts:60-66`
- **Issue:** `this.storage.get()` with no args fetches ALL chrome.storage.local, then filters by prefix. Performance degrades as storage grows.
- **Fix:** Use `chrome.storage.local.get(null)` with key filtering, or maintain a key index.
- [ ] Not started

### A11. Oversized Vue components
- **Files:** `ImportPopup.vue` (1152 lines), `execute/index.vue` (995), `capabilities/index.vue` (812), `SendPopup.vue` (667)
- **Fix:** Decompose into smaller child components.
- [ ] Not started

### A12. `@ts-ignore` masking type errors (7 instances)
- **Files:** `execute/index.vue:6,8,51`, `capabilities/index.vue:6,53`, `verify/index.vue:7`, `discover/index.vue:32`
- **Fix:** Replace with `@ts-expect-error` + reason, or fix underlying types.
- [ ] Not started

### A13. Request ID via `Math.random()`, duplicated
- **Files:** `background/client.ts:138-142`, `offscreen/client.ts:133-139`
- **Issue:** IDs are floats in (1,2). Same code duplicated. Should be auto-incrementing counter extracted to shared util.
- [ ] Not started

### A14. Silent error swallowing in Full Reset
- **File:** `src/popup/pages/settings/advanced/index.vue:156-157`
- **Issue:** `catch (error) { // TODO: handle errors }` — user gets no feedback.
- [ ] Not started

---

## LOW

### A15. No ESLint/Prettier config
- **Issue:** `strict: true` in tsconfig but no lint rules to catch `any`, `@ts-ignore`, raw `console.error`.
- [ ] Not started

### A16. Magic numbers/strings
- **Issue:** PBKDF2 iterations (600,000), storage keys, toast durations, gas TTLs hardcoded without named constants.
- [ ] Not started

### A17. Dead code
- **Files:** `notifications.ts` (entirely commented out), `token-balance/service.ts:235-247` (commented sync logic)
- [ ] Not started

### A18. Duplicate service listener patterns
- **Issue:** `service.onXyz.add(handler)` pattern repeated identically across 9+ Vue components. Should be a composable.
- [ ] Not started

### A19. `exportPlain` returns `credentialId` for passkey profiles
- **File:** `src/wallet/services/profile/service.ts:450-451`
- **Issue:** Naming is misleading — returns a WebAuthn public identifier, not secret material. Has auth via `confirmProfileOperation`. Design concern, not security.
- [ ] Not started

---

## Testability Assessment

### Current State
- **6 test files, 55 tests.** Only utils and task service have meaningful coverage.
- **Zero tests** on all security-critical and business-critical paths.

### Why It's Hard to Test

1. **No dependency injection.** Services instantiate their dependencies directly:
   ```typescript
   private readonly profiles = new ProfileServiceClient();
   private readonly config = new ConfigServiceClient();
   ```
   Can't inject mocks without monkey-patching.

2. **`ServiceCollection.get()` string-based lookup.** Services find each other via a global registry with string keys. No compile-time safety, no test seams.

3. **Chrome API coupling.** Services use `chrome.storage`, `chrome.runtime`, `chrome.offscreen` directly. These don't exist in test environments without heavyweight mocking.

4. **Async RPC bridge.** The service worker <-> offscreen boundary serializes everything through JSON. Testing the real flow requires both environments running.

### What's Testable Today (Low Effort)
- **Pure functions:** Extract business logic into pure functions (like we did with `fee-detection.ts`). Test those directly.
- **Utility classes:** `Lock`, `ReadWriteGuard`, `EntityStorage` (with a storage mock), `EncryptionKey`.
- **Schema validation:** Zod schemas can be tested in isolation.
- **Vue components:** With `@vue/test-utils` + vitest, components can be tested if service clients are mockable.

### What Would Unlock Broader Testing (Medium Effort)
- **Constructor injection for service clients.** Pass dependencies in constructor with defaults for production:
  ```typescript
  constructor(profiles = new ProfileServiceClient(), config = new ConfigServiceClient())
  ```
  Tests pass mocks. No architecture change needed, just constructor signatures.

### What Would Require Architecture Changes (High Effort)
- **Abstract Chrome APIs behind interfaces.** Create `IStorage`, `IRuntime` wrappers. Swap with in-memory implementations in tests.
- **ServiceCollection -> proper DI container.** Replace string-based lookup with typed container.
- **Extract business logic from service classes.** Move orchestration logic into testable functions that receive dependencies as arguments.

### Recommended Testing Priority
1. `ProfileService` — secrets, encryption, export/import (security-critical)
2. `ExecutionService` — tx building, fee estimation, auth witness logic (business-critical)
3. `WalletSdkDispatcher` — capability enforcement, input validation (security boundary)
4. Schema validation at dApp input boundaries (all RPC handlers)
