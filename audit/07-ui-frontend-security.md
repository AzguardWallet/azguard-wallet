# Phase 7 — UI & Frontend Security

## F-P7-01: Clipboard Not Cleared After Seed/Key Export (CRITICAL)

**Files:**
- `src/popup/pages/settings/security/export/seed.vue:67-74`
- `src/popup/pages/settings/security/export/key.vue:91-98`

```typescript
const handleCopy = () => {
    isCopied.value = true
    window.navigator.clipboard.writeText(phrase.value)
    openToast({ label: "Seed phrase is copied", icon: "copy" })
    setTimeout(() => { isCopied.value = false }, 2500)
}
```

When users copy their seed phrase or private key, the clipboard is **never cleared**. The `onBeforeUnmount` hook clears the local Vue ref but does not call `navigator.clipboard.writeText("")`.

The export page auto-closes after 5 minutes (seed.vue:58-60), but by then the seed phrase has been in the clipboard for up to 5 minutes — and remains there indefinitely after navigation.

**Impact:** Critical. Any application with clipboard read access (malware, other extensions, Electron apps) can silently harvest seed phrases. This is a well-known attack vector for cryptocurrency wallets.

**Recommendation:**
```typescript
// Clear clipboard after 30 seconds
setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => {});
}, 30_000);

// Also clear on unmount
onBeforeUnmount(() => {
    navigator.clipboard.writeText("").catch(() => {});
    phrase.value = null;
});
```

---

## F-P7-02: No URL Protocol Validation for External Links (MEDIUM)

**File:** `src/composables/externalLinks.ts:27-57`

```typescript
if (mode === "enabled") {
    window.open(url, "_blank", "noopener,noreferrer")
}
```

The `handleExternalLink` function opens URLs without validating the protocol. If a dApp provides a `javascript:` or `data:` URL in its metadata, it could be opened directly.

**Impact:** Medium. Requires a malicious dApp to inject a crafted URL into its own metadata. The `noopener,noreferrer` flags mitigate some risks, but `javascript:` URLs bypass these protections.

**Recommendation:** Validate URL protocol before opening:
```typescript
const parsed = new URL(url);
if (!["http:", "https:"].includes(parsed.protocol)) return;
```

---

## F-P7-03: dApp Logo URL Not Validated (LOW)

**File:** `src/composables/externalImage.ts:44-51`

External images are fetched via `fetch(url, { mode: "cors" })` with no URL validation or timeout. The fetch respects the user's `uploadExternalImages` privacy config, but when enabled:
- Any URL is fetched (no domain restriction)
- No timeout (slow servers block UI)
- No content-type validation (could fetch non-image responses)

**Impact:** Low. CORS mode prevents some attacks. The privacy toggle is the primary defense.

**Recommendation:** Add URL protocol validation, a 10-second fetch timeout, and content-type checking on the response.

---

## F-P7-04: Pinia State Not Cleared on Wallet Lock (MEDIUM)

**Files:**
- `src/stores/app.store.ts:49-59`
- `src/stores/cache.store.ts:32-36`

When the wallet locks, Pinia stores retain sensitive state in memory:
- `profile`, `account`, `accounts` — identity information
- `transactions` — activity history
- `claimParameters` — fee data

None of the stores listen for `ProfileService.onActiveProfileChanged` to clear state on lock.

**Impact:** Medium. State persists in the Vue runtime even when the wallet is "locked." Accessible via browser DevTools or memory dump. Less impactful than F-P4-01 (persistent storage) but violates defense-in-depth.

**Recommendation:** Add a lock listener to each store that clears sensitive state:
```typescript
profileService.onActiveProfileChanged.add((profile) => {
    if (!profile) {
        // Wallet locked — clear state
        account.value = null;
        accounts.value = [];
        transactions.value = [];
    }
});
```
