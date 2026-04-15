---
name: e2e-testing
description: Write and run E2E tests for the Nulo browser extension using Vitest + Puppeteer. Use when user says "write e2e test", "add e2e", "browser test", "test extension", "puppeteer test", or wants to test extension UI flows.
---

# E2E Testing — Vitest + Puppeteer (Chrome Extension)

## Stack

- **Vitest** — test runner
- **Puppeteer** — browser automation via Chrome DevTools Protocol
- Extensions require `headless: false`

## Debugging

When tests fail, **don't speculate — instrument**:
- Write a standalone debug script (`npx tsx tests/e2e/debug.ts`) that launches the extension and logs page state, console messages, request failures, and hash over time
- Use Chrome DevTools MCP on the dev extension to compare working vs broken behavior
- Verify assumptions about Puppeteer/Chrome APIs before coding fixes

## Writing New Tests

Before writing any test, **explore the actual UI first** using Chrome DevTools MCP (`chrome-extension-debug` skill):
1. Open the extension page in Chrome (`chrome-extension://<ID>/src/popup/index.html`)
2. Take snapshots to see what elements, text, and structure are on each page
3. Click through the flow manually to understand what changes at each step
4. Note exactly what's visible after each action — these become your assertions

This prevents guessing at selectors and ensures tests assert on real observable state.

## Best Practices

- Collect `console.error` and `pageerror` events during each test, assert empty at the end — catches silent JS errors that assertions miss
- **Assert post-action state, not just navigation.** A route change alone doesn't prove a flow worked. After registration, verify the account address is rendered, network is shown, etc. After any mutation, check its observable side effects.
- **Browser-per-file isolation.** Each test file launches its own browser via `test.extend()` with `scope: "file"`. This is the only reliable way to get independent extension tests — shared browsers leak SW in-memory state between files.

## Gotchas

- **SW "target found" ≠ ready.** `browser.waitForTarget(type=service_worker)` only means Chrome registered the script. The SW may still be loading WASM, config, or initializing services. Poll an app-specific readiness signal (e.g. `chrome.storage.session` heartbeat) before opening pages.
- **Puppeteer SW evaluate ≠ extension context.** `chrome.storage` and other extension APIs aren't available when calling `evaluate()` on a service worker target. Open an actual extension page to access these APIs.
- Route transitions are async (e.g. registration) — poll `window.location.hash`, don't wait for text
- Modals/overlays don't change the route — detect by snapshot content
- Many interactive elements are divs, not `<button>` — use `text/` selectors in puppeteer
- `networkidle0` will timeout on extension pages (persistent connections) — use `domcontentloaded`
- Don't filter console errors as "benign" — investigate and fix them. Previous "benign" errors turned out to be a broken favicon path and missing SW readiness check.
- **Never use `chrome.runtime.reload()` for state reset** — it kills the extension and all its page contexts, crashing the browser connection. Use browser-per-file isolation instead.
- **Vitest orders files by mtime, not alphabetically** — don't rely on file execution order. Design tests to be order-independent via fixtures.
- **`Button.vue` doesn't set HTML `disabled` attribute** — it uses CSS `pointer-events: none` instead. `btn.disabled` is always `false`. To check if a Button is enabled, use `getComputedStyle(btn).pointerEvents !== "none"`. If you skip this, click handlers like `handleMint` silently return early via their own `if (!isAllowed) return` guard.

## References

- [Chrome Extension Testing with Puppeteer (official)](https://developer.chrome.com/docs/extensions/how-to/test/puppeteer)
- [Puppeteer API](https://pptr.dev/api)
- [Puppeteer Chrome Extensions guide](https://pptr.dev/guides/chrome-extensions)
- [MetaMask e2e test setup](https://github.com/MetaMask/metamask-extension) — see `test/e2e/`
