---
name: quality-assessment
description: Pre-commit polish gate — a project-aware quality review that checks changed code against Azguard's quality values and patterns, verifies the change doesn't break its consumers (blast radius), and produces a prioritized fix list (security and breakage first, types and DX second, minor polish last). Reports findings first; applies fixes only after the user approves. Use when user says "quality assessment", "qa", "quality check", "quality pass", "polish this", "finalize", "clean up", runs /quality-assessment or /qa. Also trigger when user finishes a feature and wants to ship — e.g. "is this ready?", "anything to fix?", "let's wrap up". Think of it as the last step before committing.
---

# Quality Assessment

Pre-commit polish gate. Analyze changed code, report a prioritized fix list, apply only the fixes the user approves, save report.

This is not a generic code review: it encodes this project's quality values, past bugs, and conventions. Its job is to turn working code into production-quality code — and to catch the change that silently breaks something *outside* the diff.

## Quality Values

```
Explicit is better than implicit.
Typed is better than any.
Flat is better than nested.
Composition is better than inheritance.
Domain names are better than generic names.
One dispatch point is better than scattered switches.
Data definitions are better than class hierarchies.
Fail-closed is better than fail-open.
Restrictive defaults are better than permissive defaults.
Validation at boundaries is better than trust.
Three similar lines are better than a premature abstraction.
Simple code that does one thing is better than clever code that does everything.
```

These values guide every check below. When in doubt, refer back to them.

---

## Phase 1: Analyze

### Determine scope

Two layers of context, both matter:

1. **Uncommitted changes** (immediate focus): `git diff HEAD --name-only`
2. **Branch changes** (full context): `git diff master...HEAD --name-only`

If there are uncommitted changes, focus the review on them first — but read the full branch diff for context. If everything is committed, review the branch diff.

Read each changed file fully. Understand what the feature does before judging the code.

### Run quality checks

Analyze changed code against each check below. Skip checks with no findings. Focus on substantive issues — not nitpicks, not pre-existing problems.

#### Blast Radius (does the change break code outside the diff?)

The diff shows what changed; it does not show what *depends* on what changed. For each shared artifact the diff touches, find its consumers and verify their assumptions still hold:

- **Exported functions/types with changed signatures or semantics**: grep for imports and call sites — do callers still pass valid arguments and handle the new behavior?
- **CSS classes and module styles**: a changed selector, layout property, or removed class affects every template using it. Find all templates referencing the class and reason about how they render now (flex/grid context, sizing, overflow)
- **Component props and emits**: changed defaults, removed props, renamed events — check every parent using the component
- **Storage keys, config keys, message/event names**: producers and consumers must agree; a renamed key silently orphans old data or listeners
- **Service spec changes**: Service/ServiceClient pairs must stay in sync with their spec

This check is why the skill exists as more than a linter: intra-diff issues are visible to anyone reading the diff; broken consumers are not.

#### Security & Robustness (highest impact)

- **Silent failures on required fields**: `value ?? ""`, `array ?? []`, `field?.toString() ?? ""` on data that should always be present. Missing required data means malformed input — should throw with descriptive error or validate with Zod
- **Permissive defaults**: User-facing security toggles should default to restrictive. When adding new toggles, the safe option should be the default
- **Missing boundary validation**: Data from external sources (dApps, SDK messages, chrome.storage, URL params) used without validation. Prefer reusing existing Zod schemas from `@aztec/aztec.js` or `@aztec/wallet-sdk` over writing custom validators
- **Fail-open patterns**: Unknown input accepted or silently passed through instead of rejected

#### Type Strictness

- **`any` types**: Every `any` is a type safety hole. Find them and determine how to eliminate — generics, discriminated unions, closures, or proper type annotations. Let the code context guide the right approach
- **`as any` casts**: Each needs either elimination or a comment explaining why it's unavoidable
- **Untyped function parameters and missing return types** on exported functions
- **Vue-specific**: Class instances with private fields in `ref()` cause vue-tsc structural expansion errors. The established workaround in this project is the closure pattern — capture the typed value at construction time, expose only the result

#### Abstraction Quality

- **Scattered dispatch**: Same discriminant checked in multiple places across different files. Should centralize into one dispatch point — a factory, a definition map, or a single switch
- **Data-only class hierarchies**: Subclasses that differ only in data (strings, field names, labels) not in behavior. Should collapse into data-driven definitions — one concrete class consuming N definition objects
- **Duplicated patterns**: Same logic structure repeated 3+ times. Extract only if the abstraction has a meaningful domain name — not `processItems()` or `handleData()`
- **Over-abstraction**: Following execution requires jumping through 3+ layers for what is conceptually simple. If explaining the code requires explaining the abstraction framework first, flatten it
- **The test**: Can you name this abstraction with a domain term a team member would recognize? If not, it's probably not a real abstraction

#### Naming

- **Functions**: Should be verbs describing action
- **Types**: Should be nouns describing structure
- **Variables**: Should describe what the value represents, not its type
- **Flag generic names**: `data`, `item`, `handler`, `result`, `info`, `utils` — there's almost always a more specific term
- **Domain alignment**: Use terms from the project and SDK, not synonyms

#### Data/Logic Separation

- **Business logic in Vue components**: Complex transformations, validation, domain calculations in `<script setup>` — should extract to pure `.ts` functions
- **Side effects in pure-looking functions**: Functions that read global state or call services but look like pure computations

#### Vue Patterns

- **Monolithic components**: Template section >200 lines — extract sub-components
- **Inline styles**: `:style="{ ... }"` instead of CSS module classes
- **Script ordering**: This project follows execution-order convention (imports → macros → stores → composables → router → state → services → functions → watchers → lifecycle)
- **Missing service client cleanup**: Service clients created in components must call `.disconnect()` in `onBeforeUnmount`. Missing cleanup causes memory leaks from orphaned message port connections

### Beyond the checklist

After the checks above, set the checklist aside and do one open-ended pass. Checklists focus attention — and that focus has blind spots. Ask:

- If this change ships and something breaks in a week, what is it?
- What is *missing* from the diff that should be there? (a consumer not updated, a test not adjusted, a doc/spec now stale)
- Does the change behave correctly in the states the author probably didn't test — fresh profile, empty data, slow network, concurrent calls?

Findings from this pass are often the most valuable in the report — they're the ones no linter would catch.

---

## Phase 2: Report

Present findings as a single numbered list, sorted by priority so the user can approve fixes by number ("fix 1–4", "all except 6"). Three tiers:

1. **🔴 Critical** — security issues, broken consumers (blast radius), fail-open behavior, anything that corrupts data or silently fails
2. **🟡 Types & DX** — `any`/`as any`, missing validation, scattered dispatch, abstraction problems, business logic in components, missing cleanup
3. **⚪ Polish** — naming, formatting, inline styles, script ordering, wording of messages/comments

For each finding:
- **Location**: `file_path:line_number`
- **Issue**: What's wrong (one sentence)
- **Fix**: How to fix it (concrete, brief)

If there are many findings, list everything but expand details only for the critical and types tiers.

End the report by asking which fixes to apply. **Do not start fixing on your own** — the user decides what gets changed. They may want to fix some things themselves, disagree with a finding, or land the change as-is and clean up later.

---

## Phase 3: Fix (only approved findings)

Apply the fixes the user approved, in priority order (critical → types → polish): security issues have the highest blast radius, type fixes eliminate downstream holes, restructuring changes file layout so it goes before renames and cosmetics.

**Constraints:**
- **Preserve functionality**: Never change what the code does — only how it's structured and typed
- **Don't over-engineer**: Only fix real issues. Don't add features, configurability, or error handling for impossible scenarios
- **Respect existing patterns**: Don't introduce patterns that conflict with established conventions (Service/ServiceClient RPC, EntityStorage, Vue component ordering)
- **One pass**: Apply all approved fixes together. Don't create intermediate states

---

## Phase 4: Save report

After applying fixes, save a quality report:

**File**: `agents.local/quality-reports/{date}-{feature-name}.md` (relative to repo root, gitignored)

```markdown
# Quality Assessment: {feature name}

**Date**: {YYYY-MM-DD}
**Branch**: {branch name}
**Files reviewed**: {count}

## Findings & Fixes Applied

### Security
- {what was found and fixed, or "No issues"}

### Type Safety
- {what was found and fixed, or "No issues"}

### Abstractions
- {what was restructured, or "No issues"}

### Naming
- {what was renamed, or "No issues"}

### Other
- {anything else, or "No issues"}

## Declined / Deferred
- {findings the user chose not to fix, with their reasoning if given — or "None"}

## Files Modified
- `path/to/file.ts` — {brief description of changes}

## Values Applied
{Which quality values from the list above were most relevant}
```

Present the summary to the user so they can verify before committing.
