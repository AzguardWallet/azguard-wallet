# CLAUDE.md

Azguard Wallet — a privacy-first Chrome extension (Manifest V3) for the Aztec network.

## Commands

```bash
yarn dev              # Dev server (Chrome, port 8088)
yarn build            # Production build → dist/chrome/ (load unpacked via chrome://extensions)
yarn typecheck
yarn test             # Vitest unit tests
yarn test:e2e         # E2E tests (Vitest + Puppeteer); guide: .claude/skills/e2e-testing/SKILL.md
```

## Architecture

The popup (Vue 3 + Pinia, `src/popup/`) talks to the background service worker (`src/wallet/`) via a typed RPC pattern: `ServiceClient<Methods, Events>` (popup) ↔ `Service<Methods, Events>` (background); base classes in `src/wallet/base/`.

## Conventions

- **Auto-imports** (vite): Vue APIs, vue-router, and everything under `src/composables/`, `src/stores/`, `src/components/` are auto-imported — do not add explicit imports for these.
- **Formatting**: Vue code uses tabs for indentation (types sometimes omitted); backend TypeScript uses spaces with mandatory types. Lint is not run project-wide — don't reformat beyond your change.
- **Comments**: sparse and terse — only the non-obvious (a footgun, a why, a subtle invariant); never restate the code.
- **Vue components**: block order `<route>` (pages only) → `<script setup>` → `<template>` → `<style module>`.
  Inside `<script setup>`, order by execution flow:
  1. imports (grouped with comment headers)
  2. macros (`defineProps`, `defineEmits`, `defineExpose`)
  3. store instantiation
  4. composables
  5. route/router
  6. reactive state (refs, computed)
  7. service clients + event subscriptions
  8. functions/handlers
  9. watchers
  10. lifecycle hooks
