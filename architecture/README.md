# Architecture Knowledge Base

Persistent notes for understanding the Nulo wallet extension codebase. Built incrementally so analysis survives context resets.

## Structure

- `my-notes/` — Claude's primary analysis. One markdown per subsystem. Keep authoritative.
- `codex-notes/` — Independent analysis written by codex CLI (xhigh effort) running in parallel. Not edited by Claude; read for cross-reference.
- `research/` — Web extension wallet best practices, MV3 patterns, TypeScript testability patterns.
- `plan/` — Iterative modularization plan drafts and audit feedback consolidation.

## How to use

Before touching unfamiliar code, check `my-notes/` for the relevant subsystem. If not present or stale, do the read, write the note, then proceed.

Update notes when subsystem structure changes materially. Do not log every commit — notes are conceptual snapshots, not changelogs.
