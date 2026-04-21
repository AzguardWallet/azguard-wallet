## BLOCKERS

- The schedule is internally inconsistent and not credible enough to staff against. The summary says `M1` is 2 weeks and `M2` is 3-4 weeks, but the detailed timeline spends Weeks 1-3 on `M1` and Weeks 4-9 on `M2`; `M2.2` is also sized at 1-2 weeks for the repo's largest service plus dual-run/golden-fixture work. I would not approve dates that contradict the body of the plan. (`architecture/plan/02-final-plan.md:33-36`, `architecture/plan/02-final-plan.md:166-179`, `architecture/plan/02-final-plan.md:343-350`, `architecture/codex-notes/11-testability-gaps.md:43-48`)

- "Test harness first" is not what this sequence does. `M1.1` and `M1.2` make the hardest restart-state changes before `M1.3`/`M1.4` create seams, while runtime contract tests are deferred to `M2.4`. In the current code, the worker bootstraps at module evaluation time, services start via `Promise.all`, and popup imports eagerly connect real clients. That is refactor-first, not harness-first. (`architecture/plan/02-final-plan.md:23-26`, `architecture/plan/02-final-plan.md:60-105`, `architecture/plan/02-final-plan.md:193-202`, `packages/extension/src/wallet/index.ts:30-126`, `packages/extension/src/utils/core.js:14-27`)

- `M1` promises restart-safe critical flows without defining the popup↔SW transport contract that currently breaks under restart. The client auto-reconnects, drops in-flight requests on disconnect, has only a 10s warning instead of a hard timeout, and events have no replay/snapshot semantics. Persisting approval envelopes and a tx journal helps, but it does not by itself make the runtime restart-safe. (`architecture/plan/02-final-plan.md:142-149`, `architecture/plan/02-final-plan.md:193-202`, `packages/extension/src/wallet/base/background/client.ts:50-133`, `architecture/my-notes/06-synthesis.md:16-20`, `architecture/my-notes/06-synthesis.md:117-123`, `architecture/research/mv3-wallet-state-of-the-art.md:34-40`)

## SHOULD-FIX

- The first port set is too shallow for the problems you are claiming to solve. `Clock`/`BrowserApi`/`StoragePort` do not address the hard couplings that actually block tests: `ExecutionService` constructs `PxeServiceClient` itself, `NetworkService` creates node clients inline, `DappInteractionService` and `PasskeyService` call `chrome.windows.create` directly, and `TokenBalanceService` owns an endless worker loop. (`architecture/plan/02-final-plan.md:82-95`, `architecture/plan/02-final-plan.md:204-209`, `architecture/codex-notes/11-testability-gaps.md:83-122`, `packages/extension/src/wallet/services/execution/service.ts:177-188`, `packages/extension/src/wallet/services/network/service.ts:86-89`, `packages/extension/src/wallet/services/network/service.ts:232-247`, `packages/extension/src/wallet/services/dapp-interaction/service.ts:173-193`, `packages/extension/src/wallet/services/passkey/service.ts:59-84`, `packages/extension/src/wallet/services/token-balance/service.ts:73`, `packages/extension/src/wallet/services/token-balance/service.ts:233-256`)

- `M1.3`, `M1.4`, and `M1.6` should not be treated as independent 2-day PRs. They all rewrite the same bootstrap surface in `wallet/index.ts` and `ServiceCollection.start()`, and `M1.6` also omits the out-of-band `initWalletSdkHandler` step from the ordering model. This is one coupled arc. (`architecture/plan/02-final-plan.md:82-130`, `packages/extension/src/wallet/index.ts:74-104`, `packages/extension/src/wallet/base/index.ts:25-45`)

- `M2.2` is too large for one PR. Seven extracted collaborators, a feature-flagged dual pipeline, and golden-file coverage on the largest service in the repo is not a single reviewable change. Split it before the parallel-run step. (`architecture/plan/02-final-plan.md:166-179`, `architecture/codex-notes/11-testability-gaps.md:43-48`, `architecture/my-notes/06-synthesis.md:33-35`)

- `M1.1` is underspecified and overlaps `M1.2`. `TaskService` is not an "envelope" map; it is a nested task tree with retention and UI events. Decide whether restart UX is driven by a durable operation journal or full task-tree recovery, because doing both as written is duplicate work and the estimate is light. (`architecture/plan/02-final-plan.md:60-78`, `packages/extension/src/wallet/services/task/service.ts:31-32`, `packages/extension/src/wallet/services/task/service.ts:45-82`, `packages/extension/src/wallet/services/task/service.ts:218-234`)

- `M2` ignores two runtime-heavy blockers that your own notes call out: `TokenBalanceService` and `NetworkService`. If those survive untouched, you still keep a polling worker and inline node creation inside the browser shell after the supposed "ports + splits" milestone. (`architecture/plan/02-final-plan.md:152-209`, `architecture/codex-notes/11-testability-gaps.md:43-48`, `packages/extension/src/wallet/services/token-balance/service.ts:50-74`, `packages/extension/src/wallet/services/token-balance/service.ts:233-256`, `packages/extension/src/wallet/services/network/service.ts:232-247`)

- `M3` is materially under-estimated. The build is wired around `packages/extension/src` aliases, Vite auto-import/component scanning, and extension-specific entrypoints. Seven workspace extractions plus boundary enforcement is build-system work, not just module moves. (`architecture/plan/02-final-plan.md:212-231`, `packages/extension/vite.config.ts:39-63`, `packages/extension/vite.config.ts:88-133`, `packages/extension/tsconfig.json:1-24`, `package.json:2-21`)

## NITS

- The preamble cites note files that do not exist as written. The actual sources are split files plus `06-synthesis.md` and `14-plan.md`; fix the references before this becomes the canonical plan. (`architecture/plan/02-final-plan.md:3`, `architecture/my-notes/06-synthesis.md:1-3`, `architecture/codex-notes/14-plan.md:1`)

- "Feature-flag big refactors" is vague against this repo's current reality. The codebase has build-time defines and some store flags, but no obvious rollout mechanism for an old/new execution pipeline. Say where that flag lives. (`architecture/plan/02-final-plan.md:25`, `architecture/my-notes/05-ui-build-test.md:328-345`, `packages/extension/vite.config.ts:190-202`)

## WHAT'S GOOD

- The top-level order is correct: restart safety before package extraction, and package extraction after internal seams. That matches both the MV3 failure mode and the current code shape. (`architecture/plan/02-final-plan.md:11-16`, `architecture/plan/02-final-plan.md:214-223`, `architecture/research/mv3-wallet-state-of-the-art.md:18-30`)

- The guardrails on crypto invariants are the right level of paranoia. Those boundaries are real and easy to accidentally break during cleanup. (`architecture/plan/02-final-plan.md:20-27`, `architecture/my-notes/06-synthesis.md:64-75`)

## QUESTIONS FOR THE AUTHOR

- Is seamless SW-restart survival for passkey-only profiles a product requirement or not? The current code only restores password sessions. (`architecture/plan/02-final-plan.md:245`, `packages/extension/src/wallet/services/profile/service.ts:68-70`, `architecture/my-notes/06-synthesis.md:62-67`)

- What is the source of truth for `M2.2` golden fixtures: captured sandbox transactions, replayable local chain fixtures, or something else? The plan requires them but never names the fixture source. (`architecture/plan/02-final-plan.md:25`, `architecture/plan/02-final-plan.md:177`)

- Is broad content-script injection a hard product requirement, or just today's expedient default? The answer changes the real size of `M4.1`. (`architecture/plan/02-final-plan.md:239`, `packages/extension/manifest/manifest.config.ts:25-31`)

- Where does runtime flag state live for old/new pipeline parallel-run? I do not see a current mechanism that fits that rollout shape. (`architecture/plan/02-final-plan.md:25`, `architecture/my-notes/05-ui-build-test.md:328-345`, `packages/extension/vite.config.ts:190-202`)
