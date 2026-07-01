---
name: update-aztec
description: Upgrade the Azguard wallet to a new Aztec version. Use when user says "update aztec", "upgrade aztec", "bump aztec to vX", "move @aztec/* to vX", or wants to migrate the wallet to a newer Aztec release.
---

# Update Aztec

Bump the wallet's `@aztec/*` to a target Aztec version. **Wallet repo only.** Work *with* the user — they read the migration notes too; agents propose, the user approves before edits. Bundled contract artifacts are an **input**: on a major bump they're regenerated outside this skill (ask the owner where if unclear).

## Classify the bump first — everything forks on this

**Minor** — wallet-only. Bump `@aztec/*`, adapt the JS ripple. Contracts untouched, **bundled artifacts stay PINNED**: recompiling changes `classId` → the derived address for a seed → existing accounts unreachable (the newer PXE loads pinned artifacts via compat shims). Say so explicitly. No sentinel bump.
- If pinned JSON stops matching `NoirCompiledContract` (new required field), cast `as unknown as NoirCompiledContract` — the runtime shim defaults it, the cast just silences typecheck.

**Major** — one or both deep triggers; either makes it major:
- **Rollup / protocol version changed** (rc.2 did) — an old wallet can't transact on the new network, so the bump is forced even with a tiny code ripple. Protocol contract addresses may move too.
- **Account address hard fork** — derivation inputs change (`classId` from recompile, `PublicKeys` hashing, salted-init) → same seed, new address, no migration. This drops the pinned-artifact rule:
  - Regenerated artifacts come from outside this skill (ask the owner if unclear); drop them into the bundled paths and confirm they load at runtime.
  - Bump `package.json` `sentinel` → fires the `aztecReset` "Profile Reset Needed" prompt (`deleteProfile` cascade).
  - Run the migration audit (below).
  - Legacy-build / asset-migration is a product decision to flag, not skill work.

## Workflow

1. **Classify** (above); tell the user the path.
2. **Get aztec-packages at the target TAG.** The agent does/verifies the checkout — don't assume the owner left it on the right ref. Local checkout → `git fetch && git checkout <tag>`; else offer to clone to scratch. Read migration notes from the tag's versioned docs, not `next`.
3. **Baseline.** Confirm `yarn typecheck` + `yarn test` are green before any change; the upgrade must keep them green.
4. **Branch** named after the tag (e.g. `v5.0.0-rc.2`).
5. **Research — two deliverables, before editing:**
   - **(a) Per migration-note.** Sources: tag's `migration_notes.md`, `git log <current>..<target>` (`feat!`/`refactor!`/`fix!`), `release-notes-*`. Sub-agent per entry (batch trivial ones): affects us? what edits? what opportunities? Catches silent behavior changes that don't fail to compile.
   - **(b) SDK-surface diff.** Diff each invariant surface (see Interface sync) at the target vs what the wallet handles. A new field/method that compiles but is unhandled is the failure mode — why `registerContractClass` was missed.
6. **Plan + approve.** Show the change list + both research outputs; present options where they exist. Explicit approval before editing.
7. **Apply.** Deps first (`@aztec/*` → target, add split packages, align peers, `yarn install`), then the edits. Commit in layers as you go (see Commit layering).
8. **Silent-break sweep** (see block).
9. **Major only:** bump `sentinel`, run the migration audit, drop in the regenerated artifacts + confirm they load.
10. **Verify.** typecheck/build vs baseline. A green build ≠ works (v5's PrivateFPC throw built fine); real acceptance is a runtime/e2e run — harness/owner territory, not a gate here. Auto-check what you can, flag the rest.
11. **Report** (see block).
12. **Optional:** rebuild the branch into clean layers (see Commit layering) in a worktree — do it silently only if easy, else propose it.

## Interface sync — the invariant surfaces

The wallet mirrors the SDK; walk these every bump (this is also the 5b diff):
- **Capabilities + methods.** Enumerate cap interfaces/action-fields (`@aztec/aztec.js/dest/wallet/capabilities.d.ts`) + `Wallet` methods (`wallet.d.ts` alongside); diff vs `aztec-sdk/adapter.ts`. Full wiring path for a new one: map + dispatch (`adapter.ts`), operation type + union (`execution/models/operation.ts`), handler (`execution/service.ts`), **and the approval UI** (`popup/components/modules/capabilities/models/UICapability.ts` — a new permission does NOT appear automatically). Wiring is part of the upgrade; keep it a separate `feat:` from the ripple.
- **`IPXE`** (`src/wallet/services/pxe/`) imports opts types from `@aztec/pxe/client/bundle` so typecheck enforces sync; propagate signature changes through `spec`/`proxy`/`client`/`service`, don't cast around them.
- **wallet-sdk handlers** (`@aztec/wallet-sdk`) — confirm unchanged (behavioral changes like heartbeat timeouts won't show in types — read the notes).
- **`BaseWallet`** is the canonical behavior reference — we don't extend it, so replicate its PXE-boundary logic. Review its `current..target` diff; compare option bags field-for-field.

Also flag SDK functions that could replace low-level logic we wrote before they existed — default keep what works, just make the user aware (→ report bucket 4).

## Silent breaks typecheck can't catch

The examples below are what bit us on past bumps — the same ones probably won't recur, they just show the *vector* to watch: values that compile fine but are semantically wrong.

**A. Silent runtime** (compiles on loose types, semantically wrong):
- positional call-arg arrays — faucet `publish_for_public_execution` 5→6 args; verify count/order vs the target artifact.
- RPC namespace strings — `node_*`→`aztec_*` (`utils/aztec-node-client.ts`).
- enum collapse — `TxExecutionResult` (`transaction/service.ts`).
- value vs type-only import under `isolatedModules` — `TxReceipt`.

**B. Hardcoded / hand-rolled mirrors of aztec artifacts:**
- storage slots — v5 reordered AuthRegistry `Storage`, swapping `approved_actions`/`reject_all` → authwit silently misreported (`utils/auth-registry.ts`). Fix: derive from `*Artifact.storageLayout.<field>.slot`.
- hand-rolled `FunctionAbi` (multicall entrypoint, auth-registry `set_authorized`) — recompute the selector (`FunctionSelector.fromNameAndParameters`) and assert it equals the target artifact's.
- `AztecAddress.fromNumber(<literal>)` for protocol contracts — use the imported constant (addresses moved; `CANONICAL_AUTH_REGISTRY_ADDRESS`/`MULTI_CALL_ENTRYPOINT_ADDRESS` removed, FeeJuice 5→3).

Sweep: `grep -rn "as FunctionAbi\|fromNumber([0-9]\|getPublicStorageAt\|_SLOT" src`, `grep -rn 'method:\s*"' src`. Verify each hit against the target artifact.

**Principle:** artifact-derived > hardcoded — `storageLayout` / recomputed selectors / imported constants track upstream; every `new Fr(n)` / literal / hand-rolled ABI is a future silent break.

## Commit layering

Keep the reviewable diff tiny by isolating churn into frozen lower commits:
1. `chore(artifacts):` regenerated account JSON — major only.
2. `chore(wasm):` `libs/@aztec/bb.js/*.wasm.gz`.
3. `chore(deps):` `package.json` deps + `yarn.lock`.
4. `feat:` (+) the source adaptation — **the diff to study**. Keep new-capability wiring as its own `feat:`.

1–3 don't build alone; fine. Re-slice a fat WIP (no `rebase -i` / `add -p` here):
```
git reset --mixed <base>
git add <artifact json>            ; git commit   # 1
git add libs/@aztec/bb.js/*.wasm.gz; git commit   # 2
git add package.json yarn.lock     ; git commit   # 3
git add -u                         ; git commit   # 4
```
- Split a mixed file: `git checkout <intermediate-ref> -- <file>`, commit, then `git checkout <tip> -- <file>` for the next.
- Fold a commit: `git checkout --detach <target>; git cherry-pick --no-commit <fixup>; git commit --amend; git cherry-pick <later>; git branch -f <branch> HEAD`.
- Verify byte-identical: `git diff --quiet <pre-restructure-ref> HEAD`; keep a backup branch.
- Comments must be version-agnostic — no "was X, now Y" referencing state a rebuild erases.

## Minimize the diff

Result = minimal diff (only what the version requires) + a list of everything else needed to fully sync (user approves into the backlog).
- Minimal correct change (v5 slot swap = swap two constants, not re-architect to artifact-derive).
- Don't fold an improvement into the diff — but **do** leave a `TODO(backlog):` at the site and add it to the deferred list. Be generous with these: whenever you see something the upgrade didn't finish or that's future work, mark it. A TODO is cheap; a lost follow-up isn't.
- A correctness fix the version forces (slot swap, arity, namespace) belongs in the upgrade. A robustness or cleanup change (artifact-derive, guard tests) belongs in the backlog. A mirror you've verified is still correct doesn't need to change at all.

## The report

Buckets, so the owner sees what remains, not just what changed:
1. Migration impacts (research aggregate).
2. Mechanical edits done (the ripple).
3. Spec-conformance wired — new capabilities/methods (part of the upgrade, not optional; full wiring path). `registerContractClass` was one.
4. Product decisions surfaced / likely follow-up — the skill flags, the owner decides (a bundled thing that lost its artifact → drop or re-add; a feature the bump opens; SDK fns replacing our logic).
5. Deferred → backlog (user approves each).

For 3–4: spawn a sub-agent per large follow-up to assess complexity; optionally an exploration sub-agent that walks the implementation and returns the approach (discard the code, keep the path). Applying any implementation is user-approved only.

## Migration audit (major / sentinel bump)

The sentinel-driven profile reset is a GC point — audit one-shot migrations/backfills by storage scope:
- `azguard:core:*` (profile-scoped: `token`/`fpc`/`account`/`network`/`contact`/`dapp-session`, `pxe` IndexedDB) is wiped by `onProfileDeleted` → the migration is dead after the wipe → **drop**.
- `azguard:ui:*` (UI prefs) survives → **keep** (dropping it loses the user's setting).

When writing a migration, tag its site `TODO(... requires wiping profiles)` so the next major finds it.

## bb.js WASM

Bundled at `libs/@aztec/bb.js/*.wasm.gz` (vite copies into the build). May need regenerating on a bump — often doesn't.
- Compare DECOMPRESSED, not `.gz` (gzip metadata makes `.gz` hashes differ spuriously): `gunzip -c a.wasm.gz | sha256sum`. Equal → no-op.
- If different: download `barretenberg-wasm.tar.gz` + `barretenberg-threads-wasm.tar.gz` from the target release, run `extract-wasm.sh` (bundled). If a symbol change is expected (signature-scheme swap), verify the decompressed wasm contains it and that it lands in `dist/`.
