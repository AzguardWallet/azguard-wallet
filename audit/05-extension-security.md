# Phase 5 — Extension Security

## F-P5-01: Content Script Injected on All Pages (MEDIUM)

**File:** `manifest/manifest.config.ts:25-31`

```json
"content_scripts": [{
    "js": ["src/content-script/content.ts"],
    "matches": ["*://*/*"],
    "all_frames": true,
    "run_at": "document_start"
}]
```

The content script is injected into every HTTP/HTTPS page and all iframes at `document_start`. This maximizes the attack surface — any page can attempt to interact with the wallet relay.

**Mitigating factors:**
- Content script is a pure relay (no secrets, no logic beyond forwarding)
- Wallet-sdk handles ECDH encryption at the protocol layer
- Discovery requires explicit user approval for new dApps

**Impact:** Medium. The broad match pattern increases extension footprint and potential for fingerprinting. Malicious pages could probe for the wallet's presence via timing side-channels on `postMessage`.

**Recommendation:** Consider restricting to known dApp domains or using `chrome.scripting.registerContentScripts` dynamically when the user connects to a new dApp. Alternatively, add a user-configurable allowlist.

---

## F-P5-02: CSP Allows wasm-unsafe-eval (LOW)

**File:** `manifest/manifest.config.ts:35-37`

```
script-src 'self' 'wasm-unsafe-eval'
```

`wasm-unsafe-eval` is required for barretenberg WASM (Aztec zero-knowledge proof generation). This is scoped to extension pages only — the content script runs in the page's CSP context.

**Impact:** Low. This is a known requirement for WASM-heavy crypto extensions. No `unsafe-inline` or `unsafe-eval` is present.

---

## F-P5-03: COEP/COOP Headers Correctly Set (INFO)

**File:** `manifest/manifest.config.ts:38-43`

```json
"cross_origin_embedder_policy": { "value": "require-corp" },
"cross_origin_opener_policy": { "value": "same-origin" }
```

These headers enable `SharedArrayBuffer` (required for multithreaded WASM) while hardening against Spectre-class attacks. The dev server (`vite.config.ts:19-23`) mirrors these headers for consistency.

No issues found.

---

## F-P5-04: Web-Accessible Resources Exposure (MEDIUM)

**File:** `manifest/manifest.config.ts:50-55`

```json
"web_accessible_resources": [{
    "matches": ["*://*/*"],
    "resources": [
        "src/assets/logo.png",
        "assets/crypto-CnyrUiQO.js",
        "assets/internal_message_types-BMuk5C_g.js",
        "assets/content.ts--8DroSOp.js"
    ],
    "use_dynamic_url": false
}]
```

Four resources are accessible from any webpage. The JavaScript files expose:
- Cryptographic utility code (key exchange, encryption helpers)
- Internal message type definitions
- Compiled content script

With `use_dynamic_url: false`, the extension ID is fixed and discoverable, enabling fingerprinting.

**Impact:** Medium. Attackers can reverse-engineer message formats and probe for the extension. No secrets are exposed, but the information aids targeted attacks.

**Recommendation:**
1. Set `use_dynamic_url: true` to randomize resource URLs
2. Restrict `matches` to specific dApp origins if feasible
3. Minimize exposed resources — evaluate whether all 3 JS files need web accessibility

---

## F-P5-05: Minimal Permissions (INFO)

**File:** `manifest/manifest.config.ts:33-34`

```json
"permissions": ["offscreen", "storage", "sidePanel", "unlimitedStorage"],
"optional_permissions": ["downloads"],
"host_permissions": ["https://azguardwallet.io/"]
```

Permission set is minimal and appropriate:
- `offscreen` — PXE execution
- `storage` — chrome.storage API
- `sidePanel` — UI
- `unlimitedStorage` — IndexedDB for PXE state + tx history
- `downloads` — optional, for receipt export
- Host permissions limited to `azguardwallet.io` only
