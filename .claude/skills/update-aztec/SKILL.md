---
name: update-aztec
description: Upgrade the Azguard wallet to a new Aztec version. Use when user says "update aztec", "upgrade aztec", "bump aztec to vX", "move @aztec/* to vX", or wants to migrate the wallet to a newer Aztec release.
---

# Update Aztec

Upgrades the wallet's `@aztec/*` dependencies to a target Aztec version — **JS-side only**. Work *with* the user: they read the migration notes too and decide what applies. Agents propose; the user approves before any code changes.

## Core principle — account artifacts stay pinned

Do **not** recompile the account contract artifacts against the new aztec-nr. Recompiling changes the contract `classId` → changes the derived address for the same seed → existing user accounts become unreachable. Keep the currently-bundled artifacts; the newer PXE loads them via legacy-compat shims (e.g. zod `.default()` for fields added later, parse-time preprocessors that fill missing fields). **Tell the user explicitly each time** that artifacts are not being updated. Revisit only at a major boundary (≈ v5 / a new mainnet), where fully re-versioning accounts may be warranted.

When a new **required** field is added to the artifact type (`NoirCompiledContract`), the bundled JSON won't structurally match → cast it `as unknown as NoirCompiledContract`. Runtime is fine (the shim defaults it); the cast just silences the static check. Add a one-line comment pointing at the upstream shim.

## Workflow

1. **Target version.** Infer from context; if unclear, ask the user.

2. **Get aztec-packages at the target.** If a local `aztec-packages` checkout is available, `git pull` and `git checkout <target>` there. If not, ask the user whether to clone it to a scratch dir (e.g. `/tmp`) at the target tag.

3. **Baseline first.** `yarn typecheck` and `yarn test` have known flaws (broken e2e, pre-existing typecheck errors). Capture both **before** changing anything. Success criterion = **no new typecheck errors (same set/files)** and tests stay green. Do not fix pre-existing errors — only ensure the upgrade adds none.

4. **Branch.** If not already on one, create a branch named after the aztec-packages tag/branch (e.g. `v4.3.0`, `v4.2.0-aztecnr-rc.2`).

5. **Analyze impact, per migration-note entry.** Sources in aztec-packages:
   - `docs/docs-developers/docs/resources/migration_notes.md` (diff current..target — primary)
   - `git log --oneline <current>..<target>` (look for `feat!`/`refactor!`/`fix!`)
   - `release-notes-*.md` in the repo root

   For each migration-note entry, spawn a sub-agent (Explore/general-purpose) to determine: does it affect us, what wallet changes it requires, what opportunities it opens. Batch the clearly-irrelevant or trivial entries together; reserve a dedicated agent for substantive ones. Aggregate the per-item reports and present them to the user. **Why per-item:** some breakages are silent — a runtime/oracle behavior change (e.g. altered scoping or propagation) can require wallet-side compensation even when nothing fails to compile. Per-item analysis catches these, where a glance at the headline would miss them.

6. **Plan + approve.** Show the change list. Invite the user's questions ("does everything match expectations?"). For any item with multiple resolution options, present the options and let the user choose — they read first, then pick. Describe the planned wallet edits. Get explicit approval before editing.

7. **Apply.** Start with the dependency bump — set `@aztec/*` to the target in `package.json`, then `yarn install`. Then make the per-item edits (see interface-sync, new-SDK-functions, and bb.js below).

8. **Verify.** Re-run typecheck/tests; diff against the baseline. Runtime verification on a sandbox of the target version is the real acceptance test (especially anything touching private note tagging/discovery — send a private tx, re-sync at the recipient, check balance). When done, offer to save the upgrade artifacts (see "Saving artifacts" below).

## Interface sync (invariant)

The wallet mirrors Aztec SDK types — keep them in sync on every upgrade:
- `IPXE` (`src/wallet/services/pxe/`) mirrors PXE; it imports opts types from `@aztec/pxe/client/bundle`. When a PXE method signature changes upstream, propagate it through our `spec`/`proxy`/`client`/`service` wrappers rather than casting around it.
- Wallet SDK types and connection handlers (`@aztec/wallet-sdk`).

For behavior, **BaseWallet** (`@aztec/wallet-sdk`) is the canonical reference — read how it derives/passes parameters and borrow that logic rather than reinventing. We are our own wallet implementation (we don't extend BaseWallet), so we must replicate what it does at the PXE boundary ourselves.

## New SDK functions vs our low-level logic

If the upgrade ships SDK functions that could replace low-level logic we wrote before they existed, surface it and let the user decide. **Default: keep what works** — just make the user aware of the option.

## bb.js WASM

The wallet bundles barretenberg WASM at `libs/@aztec/bb.js/*.wasm.gz` (copied into the build by vite). On a version bump these *may* need regenerating — but often don't.
- **Compare DECOMPRESSED content, not `.gz` bytes.** gzip embeds metadata (timestamp/OS), so `.gz` hashes differ spuriously even when the wasm is identical: `gunzip -c a.wasm.gz | sha256sum` vs the new one. If equal → no-op, leave as-is.
- If different: download the release tarballs (`barretenberg-wasm.tar.gz`, `barretenberg-threads-wasm.tar.gz`) from https://github.com/AztecProtocol/aztec-packages/releases for the target version into a scratch dir, then run `extract-wasm.sh` (bundled in this skill): it extracts and gzips them into the wallet's `libs/@aztec/bb.js/`.

## Saving artifacts

If the user has a knowledge base (a repo/dir where agent findings are aggregated), offer to save the upgrade artifacts there: the per-item migration-impact report, the final change list, and any decisions made. If no such base is found, mention it's possible but skip it.
