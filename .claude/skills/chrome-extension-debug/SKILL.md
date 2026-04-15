---
name: chrome-extension-debug
description: Debug and test the Nulo Chrome extension using Chrome DevTools MCP. Use when Chrome MCP tools are available and need to test popup UI, debug user flows, monitor network/console, or automate repetitive browser tasks.
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

## Key Routes

| Page | Route |
|------|-------|
| Main | `#/popup/general` |
| Logger | `#/windows/logger` |
| Advanced Settings | `#/popup/settings/advanced` |
