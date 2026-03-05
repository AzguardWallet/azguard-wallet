# Phase 7: UI & Frontend Security Audit

**Status:** COMPLETE
**Date:** 2026-02-26
**Severity Distribution:** 0 CRITICAL, 0 HIGH, 8 MEDIUM, 7 LOW

---

## MEDIUM FINDINGS

### F-P7-01: MEDIUM — Clipboard Not Cleared After Copying Seed Phrase

**File:** `src/popup/pages/settings/security/export/seed.vue:67-73`
```vue
const handleCopy = () => {
    isCopied.value = true
    window.navigator.clipboard.writeText(phrase.value)
    openToast({ label: "Seed phrase is copied", icon: "copy" })
    setTimeout(() => {
        isCopied.value = false
    }, 2500)  // Only resets visual indicator, clipboard NOT cleared
}
```

**Issue:** Seed phrase remains in clipboard indefinitely after copying. Any application with clipboard access can read it.

**Fix:** Clear clipboard after 30 seconds:
```typescript
setTimeout(() => navigator.clipboard.writeText(""), 30_000);
```

---

### F-P7-02: MEDIUM — Clipboard Not Cleared After Copying Private Key

**File:** `src/popup/pages/settings/security/export/key.vue:91-97`
```vue
const handleCopy = key => {
    isCopied.value = true
    window.navigator.clipboard.writeText(key === "private" ? privateKey.value : publicKey.value)
    openToast({ label: "Key is copied", icon: "copy" })
    setTimeout(() => {
        isCopied.value = false
    }, 2500)
}
```

**Issue:** Same as F-P7-01 — private key remains in clipboard indefinitely.

---

### F-P7-03: MEDIUM — General Copy Handler Never Clears Clipboard

**File:** `src/popup/components/modules/general/BalanceView.vue:96-99`
```typescript
const handleCopy = (target) => {
    window.navigator.clipboard.writeText(target)
    openToast({ label: "Successfully copied", icon: "copy" })
}
```

**Issue:** Used for copying addresses and other values. No clipboard clearing mechanism anywhere in the codebase.

**Fix:** Create a shared `secureCopy()` utility that auto-clears clipboard after a timeout for sensitive data.

---

### F-P7-04: MEDIUM — External Image Loading Without URL Validation

**File:** `src/composables/externalImage.ts:19-55`
```typescript
async function loadExternalImage(url: string): Promise<string | undefined> {
    if (!url) return undefined  // Only checks if empty
    // ...
    const res = await fetch(url, { mode: "cors" })
}
```

**Issue:** Accepts any URL including `data://`, `javascript://`, and arbitrary origins. No protocol validation, no domain whitelist, no size limit on fetched images. Used for dApp logos — a dApp-controlled URL.

**Impact:** Tracking pixels, data exfiltration via image loading, potential cache poisoning.

**Fix:** Validate URL protocol is `https:`. Add domain whitelist or size limit.

---

### F-P7-05: MEDIUM — dApp Logo URL Not Validated Before Loading

**File:** `src/popup/windows/connect/index.vue:86-93`, `src/popup/windows/execute/index.vue:93-99`
```typescript
if (dapp.value.logo) {
    dapp.value.loadingLogo = true
    try {
        dapp.value.logoBlobUrl = await loadExternalImage(dapp.value.logo)
    } finally {
        dapp.value.loadingLogo = false
    }
}
```

**Issue:** `dapp.value.logo` comes from dApp metadata (attacker-controlled). Could point to tracking beacon, oversized file, or malicious content.

**Fix:** Validate URL before loading. Fallback to placeholder on invalid URLs.

---

### F-P7-06: MEDIUM — External Links Opened Without Protocol Validation

**File:** `src/composables/externalLinks.ts:27-56`
```typescript
async function handleExternalLink(event: MouseEvent, url: string) {
    if (!url) return
    event.preventDefault()
    await initConfigClient()
    const mode = externalLinks.value
    if (mode === "enabled") {
        window.open(url, "_blank", "noopener,noreferrer")  // No protocol check
        return
    }
}
```

**Issue:** No validation that URL uses `http:` or `https:` protocol. Could be `javascript:`, `data:`, or `blob:` URLs. The `noopener,noreferrer` flags are good but insufficient if the protocol itself is malicious.

**Fix:** Validate `new URL(url).protocol` is `http:` or `https:` before opening.

---

### F-P7-07: MEDIUM — Error Messages Displayed Without Sanitization

**File:** `src/popup/windows/connect/index.vue:207-208` and similar patterns

**Issue:** Error messages from background service are displayed in the UI via `processingError.title` and `processingError.tooltip` without sanitization. If error messages contain user input or contract data, they could be rendered as-is.

**Note:** Vue 3's template interpolation (`{{ }}`) auto-escapes HTML, so XSS risk is low. However, error content could still reveal sensitive internal state.

**Fix:** Sanitize error messages before display.

---

### F-P7-08: MEDIUM — Pinia State Not Explicitly Cleared on Lock

**File:** `src/stores/app.store.ts:42-200`
```typescript
const profile = ref()
const accounts = ref<Account[]>([])
const account = ref<Account>()
const transactions = ref([])
```

**Issue:** When user locks wallet, `profile` becomes null but `transactions`, `accounts`, and other cached data may remain in memory. Not directly exploitable (requires memory dump), but violates principle of least persistence.

**Fix:** Add explicit `clearOnLock()` method that zeros all sensitive refs.

---

## LOW FINDINGS

### F-P7-09: LOW — Invalid autocomplete Attribute

**File:** `src/popup/components/popups/RegisterPopup/WalletNameContent.vue:25`
```vue
autocomplete="false"  <!-- Invalid: should be "off" -->
```

**Issue:** `autocomplete="false"` is not a valid HTML attribute value. Browsers ignore it. Should be `autocomplete="off"`.

---

### F-P7-10: LOW — Full Errors Logged to Console

**File:** `src/popup/pages/auth.vue:98-100`
```typescript
} catch (err) {
    console.error(err)  // Full error object in console
}
```

**Issue:** Full error objects logged to browser console may contain implementation details. DevTools access would reveal internal state.

---

### F-P7-11: LOW — Router Guard Async Race Condition

**File:** `src/popup/index.ts:54-96`

**Issue:** Router `beforeEach` guard makes multiple async calls (`getActiveProfile()`, `getProfiles()`). Rapid navigation could cause multiple profile fetches to race, potentially setting state to stale data.

**Fix:** Add abort controller to cancel in-flight requests on new navigation.

---

### F-P7-12: LOW — No Loading State During Route Guard Initialization

**File:** `src/popup/index.ts:72-83`

**Issue:** When `isSessionChecked` is false and an auth-required route is accessed, the guard fetches profile asynchronously. User may briefly see protected content before being redirected.

**Fix:** Show explicit loading state during async guard checks.

---

### F-P7-13: LOW — Transaction Confirmation UI — No Display-vs-Signed Verification

**File:** `src/popup/windows/execute/index.vue`

**Issue:** The execute window displays transaction details from `payload.value.session.dappMetadata`, which is dApp-controlled. No mechanism verifies that what's displayed to the user matches what will actually be signed.

**Impact:** Confused deputy attack — dApp shows one transaction description, wallet signs a different one. Mitigated by the fact that actual operation data comes from the background service, not the dApp metadata.

---

### F-P7-14: LOW — Address Trimming Uses 4 Trailing Characters

**File:** `src/utils/string.ts:6-9`
```typescript
export const trimAddress = (address: string, start = 8, end = 4): string => {
    if (!address || address.length <= start + end) return address
    return `${address.substring(0, 8)}..${address.substring(address.length - 4)}`
}
```

**Issue:** Only 4 trailing characters shown (2^16 collision space for hex). Industry standard is 6+ chars on each end.

**Fix:** Increase default to `end = 6`.

---

### F-P7-15: LOW — Password Fields Missing Copy Prevention

**Files:** Multiple auth/export pages

**Issue:** Password fields use `type="password"` (correct) but don't prevent copy operations. A compromised clipboard monitor could capture passwords if user copies from a temporarily visible password field.

---

## Positive Findings

| Area | Assessment |
|------|-----------|
| No `v-html` usage | No XSS via dynamic HTML injection |
| No dynamic template compilation | Safe from template injection |
| No innerHTML in Vue components | Safe from DOM-based XSS |
| Vue 3 auto-escaping | Template interpolation `{{ }}` auto-escapes HTML |
| Password fields typed correctly | All password inputs use `type="password"` with toggle |
| External links default "disabled" | Privacy-first default prevents tracking |
| External images default disabled | `privacyPlaceholder` used when config is off |
| `noopener,noreferrer` on window.open | Prevents reverse tabnapping |
| Auth-required route guards | Routes properly gated with `isAuthRequired` meta |
