# CLAUDE.md

Azguard Wallet — a privacy-first Chrome extension (Manifest V3) for the Aztec network. This file holds only what the code does not show: commands, footguns, and house conventions.

## Commands

```bash
yarn build            # Production build → dist/chrome/ (load unpacked via chrome://extensions)
yarn dev              # Dev server (Chrome, port 8088)
yarn typecheck
yarn test             # Vitest unit tests
yarn test:e2e         # E2E tests (Vitest + Puppeteer); guide: .claude/skills/e2e-testing/SKILL.md
```

- Run `yarn build` once before the first `yarn dev`, because the build copies dependencies the dev server needs.
- `yarn test:e2e` drives the built extension, so it needs a fresh `yarn build`.

## Architecture

The popup (Vue 3 + Pinia, `src/popup/`) talks to the background service worker (`src/wallet/`) via a typed RPC pattern: `ServiceClient<Methods, Events>` (popup) ↔ `Service<Methods, Events>` (background), base classes in `src/wallet/base/`. New background features follow this pattern, never ad-hoc messaging.

## Conventions

- **Auto-imports** (vite): Vue APIs, vue-router, `browser` (webextension-polyfill), and everything under `src/composables/`, `src/stores/`, `src/utils/`, `src/components/` are auto-imported. Do not add explicit imports for these.
- **Formatting**: Vue code uses tabs for indentation, types sometimes omitted. Backend TypeScript uses spaces with mandatory types. Lint is not run project-wide, so don't reformat beyond your change.
- **Comments**: sparse and terse — only the non-obvious (a footgun, a why, a subtle invariant), never restating the code.
- **Vue components**: block order `<route>` (pages only) → `<script setup>` → `<template>` → `<style module>`.
  Inside `<script setup>`, order by execution flow, omitting the header of an empty section:
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
