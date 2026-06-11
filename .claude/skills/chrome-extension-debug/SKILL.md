---
name: chrome-extension-debug
description: Debug and test the Azguard Chrome extension using Chrome DevTools MCP. Use when user says "walk through in browser", "open in browser", "try in browser", "check in chrome", "test in browser", "click through", "show me the flow", or when Chrome MCP tools are available and need to test popup UI, debug user flows, explore UI for e2e test writing, monitor network/console, or automate repetitive browser tasks.
---

# Chrome Extension Debugging

## Extension Pages

Open in full-page mode for easier testing:
```
chrome-extension://<ID>/src/popup/index.html
```

Get extension ID from `chrome://extensions`.

## Logger

**URL:** `chrome-extension://<ID>/src/popup/index.html#/windows/logger`

The logger captures service worker logs that are otherwise not directly visible. It shows the full RPC communication flow between popup UI and background services.

**Why it's useful:**
- Service worker has no DevTools console access - this is the only way to see its logs
- Shows complete request/response cycle: client connect → request received → processed → response sent
- Tracks all 20+ services communication (account, network, transaction, config, etc.)
- Reveals timing issues via millisecond timestamps
- Displays serialized request/response payloads for debugging data flow

**Debug Mode** (Settings > Advanced):
- OFF: 1000 logs buffer, INFO level only (lifecycle events, errors)
- ON: 10000 logs buffer, DEBUG level (every RPC call with full payloads)

**Log trimming:** Large Aztec objects (ContractArtifact, bytecode, witnesses) are automatically truncated to prevent memory issues.

**Per-line cap for agent reading:** the logger accepts a `maxLength` query param that truncates every log line to N chars (`... (truncated, full length: X)`). When reading logs via MCP snapshots, open the logger with it — full payloads flood the snapshot/context otherwise:

```
chrome-extension://<extension-id>/src/popup/index.html?maxLength=300#/windows/logger
```

Note the param goes in the query string *before* the `#` hash, not after the route.

## Key Routes

| Page | Route |
|------|-------|
| Main | `#/popup/general` |
| Logger | `#/windows/logger` (supports `?maxLength=N` before the hash) |
| Advanced Settings | `#/popup/settings/advanced` |

## Interaction Popup Windows (connect / capabilities / execute / verify)

Chrome DevTools MCP does **not** see windows opened via `chrome.windows.create` — they never appear in `list_pages`, so you cannot select, snapshot, or click them directly. Also, `new_page` with a `chrome-extension://` URL silently fails to register; pages created with `new_page("about:blank")` and then navigated via `navigate_page` to the extension URL work fine.

**Workaround — drive popups via `chrome.extension.getViews()`:**

1. `new_page("about:blank")` → `navigate_page` to any extension page (e.g. the logger route). This tab IS visible to MCP.
2. From that tab, `evaluate_script` gives you direct `Window` references to ALL extension views, including popup windows:

```javascript
() => {
  const views = chrome.extension.getViews();           // all extension pages incl. popups
  const v = views.find(v => v.location.hash.startsWith('#/windows/connect'));
  // full DOM access: read state, click buttons
  const approve = [...v.document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Approve');
  approve.click();
  return v.document.body.innerText;
}
```

Useful patterns:
- Poll for a window to appear: loop with `setTimeout` inside one async `evaluate_script` (faster than switching MCP pages).
- Toggle elements (checkboxes like "Remember this app"): click the element ONCE — clicking both element and its parent fires the Vue handler twice and toggles back.
- `chrome.storage.local.get(null)` from the extension tab inspects background state (e.g. `azguard:core:aztecSdkConnectedApps`).
- Reload the extension after a rebuild from a `chrome://extensions` page: `chrome.developerPrivate.reload(extId, {failQuietly: false}, cb)`.

**Timing caveat**: dApp discovery has a timeout (typically 30–60s) — if the connect popup isn't approved in time, the dApp reports that no wallet was found even though the wallet-side approve succeeded.

## Driving Transactions Through the UI

Empirical timings (Testnet): proof generation 40–80s, ~1–3 min per transaction total; balance refresh takes a while and is not always immediate. Poll with snapshots every ~20s — tighter polling just burns context while proofs grind.

**Sequential sends**: submit the next transaction only after the previous one's "Creating transaction" card resolves into a completed transaction with a tx hash (the label varies by operation type — not always "Transfer"). Balances can be refreshed manually if needed: ⋮ menu near "Tokens" → "Refresh balances".
