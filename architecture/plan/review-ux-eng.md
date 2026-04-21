# Review — 02-final-plan.md

Audited cold against the code and the two source notes sets. Author's instinct (restart-safety → ports → splits → packages → hardening) is correct. Calibration and sequencing are where it breaks.

## BLOCKERS

**B1. M1 is built on a test harness that does not yet exist, but M1.7 is scheduled last.**
M1.1 ("persistence + TTL"), M1.2 ("durable journal") and M1.4 ("composition root") all claim "unit tests for state transitions" and "integration test that restarts SW mid-approval" (plan §M1.1–§M1.4). Today there are 9 `.test.ts` files total under `packages/extension/src` (none on `dapp-interaction`, `execution`, `profile`, `passkey`), `vitest.config.ts` has no `chrome.*` setup in `tests/vitest.setup.ts`, and the plan's "test fake: `@webext-core/fake-browser`" only appears in M1.3. You cannot write those tests before M1.3 lands the ports and the fake-browser install. Either M1.3 moves to PR #1 of M1, or the "2-3 day" budgets on M1.1/M1.2 absorb a ~2-day harness-build that isn't in the estimate. As written the week-1 milestone commits to writing restart-safety tests with no way to run them.

**B2. M2.2 ExecutionService split is sized "1-2 weeks" for a 2,365-line file with 10 service deps, a two-pass FPC path, and a feature flag.** `wc -l execution/service.ts` = 2365 (not "2000+"). §M2.2 proposes seven new modules (`OperationPlanner`, `FeeStrategy` + 4 impls, `ContractResolver`, `TxRequestBuilder`, `ExecutionCoordinator`, `AuthwitDiscoverer`, `ExecutionFacade`) *plus* parallel-run feature flag, *plus* golden-file fixtures on real proving output, *plus* the durable journal from M1.2 wired in, *plus* AuthRegistryService side-effect untangling (my-notes/06 §10). Golden fixtures alone for FJ/FJWC/FPC/Embedded require a working local sandbox tx harness that the M5 virtual-authenticator/Playwright work hasn't started yet. Realistic range is 3-5 weeks. Under-estimating this is the single highest schedule risk in the whole plan.

**B3. M0.1 and M0.4 are mis-scoped as "emergency fixes."**
M0.1 (finish `createAuthWit` scope enforcement — `scope-enforcement.ts:202`) is a real security fix and is trivial *as a code change* (~15 lines, reuse `checkTransactionCalls`). But the plan claims "1-2 days" while simultaneously reusing "the same scope model used by `sendTx`/`simulateTx`" — that model currently lives in checkers that accept `calls: FunctionCall[]` (scope-enforcement.ts:102–128), and `CallIntent` carries a single `call` plus optional `caller`. There's a schema-shape mismatch to resolve and `scope-enforcement.test.ts` needs to grow the case matrix. Fine. But M0.4 is "write a SECURITY.md paragraph." That is not an emergency fix; it's documentation, and folding it into M0 pads the milestone count and hides that the real M0 is three patches, not four. Either remove M0.4 or be honest that M0 is "3 patches + a doc."

## SHOULD-FIX

**S1. M1.2 durable journal + M1.1 session-storage envelopes land in week 1 *before* M1.3 ports.** §M1.2 says "candidate pattern: XState actors serialized to chrome.storage". If you don't have `StoragePort` yet (M1.3), the journal will directly import `chrome.storage.session`, which is exactly what you'll have to rip out 3 days later. Re-sequence: M1.3 (ports, incl. `SessionStore`) → M1.1 → M1.2. The "2 weeks" stays; the work isn't re-done.

**S2. M1.5 "remove singletons" is listed as 2-3 days; it touches `popup/app.vue` (321 lines) plus every `composables/` and `stores/` file that reads `managers.*`.** The plan only cites `utils/core.js:14-59` and `app.vue:42-260`. Grep for consumers and you'll find every popup page that imports composables which close over the module-level clients. A backward-compat shim "for one release cycle" (§M1.5) means both paths alive simultaneously — realistically 4-6 days including the shim + the per-consumer migration + component tests asked for in the same PR.

**S3. Passkey restart-safety is deferred to M4.7 but M1.1 persists "passkey envelopes."** §M1.1 moves `passkey/service.ts:13` in-memory map to session storage. The *envelope* survives, but the passkey session master-secret does not (my-notes/06 §4: "No restorePasskeySession — passkey sessions die with the SW"). So after M1 a passkey user still loses their session mid-approval; the pending-approval record just gets garbage-collected by TTL. The plan lists passkey session symmetry (M4.7) as "days" and after M1. Either M1.1 is honest that passkey approvals still die (just no longer leak promises), or passkey symmetry gets promoted earlier. The M1 exit criterion "approval / passkey / send flow survives SW restart without becoming unrecoverable" is **false as written for passkey profiles**.

**S4. `src/utils/core.js` is a 69-line file with 5 eager `ServiceClient` instantiations, but the plan never addresses that it is `.js`.** It's the only popup-scope singleton holder and it's untyped. A "Remove popup singletons" PR that doesn't make it `.ts` is missing the seam. Mentioned in my-notes/06 §7 ("~10 `.js` files should be `.ts`"). Not a blocker, but the plan's §"Non-goals" disclaims "fix all `any`" — it should explicitly *carve in* core.js → core.ts.

**S5. M3 extraction order puts `@nulo/wallet-crypto` at #2, but no KDF/crypto freeze is declared first.** §Guardrails names the labels but doesn't call out that you need *a pinned test vector set* before moving the KDF into another package. If `nulo:kdf:v1`, `nulo:master:v1`, `nulo:profile:v1` labels get subtly re-imported with different string normalization during the package split, every existing passkey profile is bricked. Add an M2-level PR: "crypto test vectors + cross-version regression suite" as a prerequisite to M3 extraction #2.

**S6. M2.3 PxeService narrowing includes "Finish `ReadWriteGuard` (real reader counting + drain)" as a bullet inside 1-2 weeks.** my-notes/06 §6 documents this as a real race. `rw-guard.ts:11` has a TODO. That's a concurrency primitive rewrite with its own unit tests — budget it as a separate 2-day PR inside M2.3, not a bullet.

**S7. M2.4 "contract tests on runtime edges" is sized 3-5 days for popup↔SW + SW↔offscreen + content-script bridge, three separate wire protocols.** The SW↔offscreen transport has custom uid addressing, 90s timeout, 20s keepalive, and zombie-kill logic (my-notes/06 §1). Each of the three deserves ~3 days. 3-5 days for *all three* is wishful.

**S8. "Content-script scope review" (M4.1) is gated on "product requirement explicit?" (Q2). This is a go/no-go that the engineering team cannot resolve alone and should be pulled forward to the discovery phase, not parked in M4.** The broader question — "do we actually need `*://*/*` `document_start` `all_frames`?" — affects any security review of the wallet. If the answer is "no", content-script shrinking reduces the attack surface exposed by everything in M1-M3. Ask the question now.

**S9. No plan item covers the ephemeral event bus ("no replay, no snapshot-with-subscribe handshake" — my-notes/06 §8).** Popup reconnect after SW restart loses emitted events; consumers resync ad-hoc. The M1 journal handles *send*, but the same pattern exists for every other service. Missing from the risk register and from M2.4.

**S10. M1.6 drops the 30s `ensureInitialized()` poll without a circular-dep audit.** Phase graph has Phase 1 Profile before Phase 2 Account/Task, but `DappInteractionService` imports ProfileService (verified at dapp-interaction/service.ts:43-58) and today any service can call any other during `init()`. If Phase-1 init touches a Phase-2 service, you get a deadlock instead of a 30s poll that eventually resolves. Add "cycle detection + explicit init-phase contract per service" as part of M1.6, and keep the fallback poll until all 20 services are audited.

## NITS

- §M0.3: "Clone `op.actions` before `unshift`-ing" — the popup estimator (`execution/service.ts:373`, per my-notes/06 §10) already clones defensively. Mention it in the PR so the defensive copy can be removed in the same commit.
- §"Milestones at a glance" says M1 is "~2 weeks" but Execution Order week-1 includes M0 (~3 days) *and* M1.1 *and* M1.2. That's ~2.5 weeks of content in week 1. Update the glance table to "~3 weeks incl. M0".
- §M5.7 Stryker mutation testing on `wallet/services/{account,transaction,profile,execution}` — execution.ts is 2,365 LOC pre-split. Defer mutation coverage on execution until *after* M2.2 lands. Mutating a God class gives noise.
- §Risk register R4 "Content-script injected on every page" — severity is **high** but addressed in M4 (week 13+). Given it's listed as high attack surface, either downgrade the severity or promote the scoping review.
- §Open question 3 (XState vs hand-rolled) — answer it before M1.2. Blocking a decision on XState for the durable journal means the M1.2 PR author can't start.

## WHAT'S GOOD

- Sequencing intuition (restart-safety → ports → splits → packages) matches the codex notes and industry practice cited in `research/mv3-wallet-state-of-the-art.md`.
- M0.1 (`createAuthWit`) correctly pulled out as emergency, not deferred to M2.
- Guardrails §1 explicitly names KDF labels + `AccountType` enum as immutable — preserves the single biggest footgun.
- Feature-flag requirement on M2.2 (parallel-run old + new pipeline) is the right call for a 2,365-LOC split.
- M3 extraction *order* (core → crypto → messaging → aztec-runtime → bridge → ui → extension) is correct; does not extract Aztec runtime before ExecutionService is split.
- Recognizes the passhash question (M4.2) is a product decision, not an engineering one.

## QUESTIONS FOR THE AUTHOR

1. Is any M1 PR allowed to merge before M1.7 (e2e harness) proves the three critical flows still work? If yes, M1.1/M1.2 ship untested against real SW restart. If no, restate M1.7 as PR #1.
2. M4.2 (passhash hardening) is called "product decision gate" — who owns that decision and by when? M2.1 (ProfileService split) touches the same code; do we split without knowing the final session design?
3. Is the "one engineer, 14 weeks" staffing assumption real? If yes, M2.2 alone is a 3-5 week solo effort and Weeks 6-7 are not enough.
4. Golden fixtures for the ExecutionService feature flag — where do they come from? Captured from a running sandbox? If so, sandbox harness is a prereq not mentioned.
5. XState vs hand-rolled reducer (Q3) — decide now. 30KB gz into a Chrome extension matters less than forcing the M1.2 author to pick under time pressure.
6. Are passkey-only profiles a supported production config today, or beta-only? If beta, M4.7 can slip; if production, M1 exit criteria is wrong.
7. M3 package extraction — does this plan assume `@nulo/wallet-core` et al. are published privately, or only workspace-local? Affects whether you need registry/OIDC setup (nothing in plan covers this).
