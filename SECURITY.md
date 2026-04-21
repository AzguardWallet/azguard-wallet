# Security

This document captures security-relevant design decisions for the Nulo wallet
extension. It is written for engineers working on the codebase; if you are a
security researcher, see the reporting section at the bottom.

## Crypto-bound invariants (never change without a migration)

These values are cryptographically bound. Changing any of them invalidates
existing keys and profiles.

- **KDF domain separator labels**
  - `nulo:profile:v1` — WebAuthn PRF input label
    (`src/wallet/services/passkey/spec.ts:PASSKEY_PRF_LABEL`)
  - `nulo:kdf:v1` — HKDF salt label
    (`src/wallet/services/passkey/credential.ts:PASSKEY_KDF_LABEL`)
  - `nulo:master:v1` — HKDF info label
    (`src/wallet/services/passkey/credential.ts:PASSKEY_MASTER_LABEL`)
- **`AccountType.Nulo_v1 = 0`** — embedded in the Poseidon hash used to derive
  account secrets from the master secret. The numeric value is part of the
  hash input; renaming the enum is fine, but reassigning the numeric value
  is not (`src/wallet/services/account/spec.ts`).
- **AES-GCM ciphertext format** — `[1 version byte][12 byte IV][ciphertext]`
  stored base64 in `profile.secret` and `profile.guard`
  (`src/wallet/services/profile/encryption/encryption-key.ts`).
- **Passkey RP ID** — `nulo.sh`, used at credential creation. Changing it
  invalidates every existing passkey credential
  (`src/popup/windows/passkey/index.vue`,
  `manifest/manifest.config.ts` host_permissions).
- **`SchnorrAccountContractArtifact`** — the upstream Aztec Schnorr account
  contract; the class id is pinned by the upstream `@aztec/accounts` version.
  Bumping that dependency changes the class id and orphans existing accounts
  unless handled via migration.

Any PR that touches these must include:
1. Explicit mention of the invariant being changed.
2. A migration plan for existing users.
3. Cross-version regression test vectors.

## Session secret (password profiles)

**Current design (intentional, noted for future review).**

When a user unlocks a password profile, the following happens:

1. The password is hashed once with SHA-256 to produce `passhash`.
2. `passhash` is persisted to `chrome.storage.session` (session storage — not
   `local` — cleared when Chrome fully terminates).
3. `passhash` is re-imported as a PBKDF2 base key (600k iterations, SHA-256)
   and used to decrypt the encrypted master secret on every unlock.

The consequence is that **`session.passhash` is sufficient to decrypt the
master secret**, not merely to verify it. It is a bearer credential for the
profile during the active browser session.

### Why it is designed this way

MV3 service workers suspend aggressively (~30s idle). Re-prompting the user
for their password on every wake would be hostile. The design trades a
narrow in-session security surface for a usable session model.

### Threat model

| Attacker capability | Impact |
|---|---|
| Can read `chrome.storage.session` (eg. another compromised extension with `storage` permission for the same origin) during an active session | **Full compromise of the password-unlocked master secret** |
| Can observe disk during a browser-locked / Chrome-exited state | No impact — session storage is not persisted across full browser termination |
| Can observe disk during a browser-running / wallet-locked state | Partial — can read the encrypted `profile.secret`/`profile.guard`, but cannot decrypt without `passhash`; must brute-force the password (600k PBKDF2) |
| Can read process memory during an active session | Full compromise (the master secret is held as `Fr` in service-worker memory) |

### Known gaps tracked in the refactor plan

- **M4.2**: replace `passhash` with a session token that cannot itself decrypt
  the secret. Candidates: device-local session key wrap, or require re-auth on
  SW restart.
- **M4.3**: best-effort zeroization of decrypted secret + passhash buffers.
- **M4.5**: proactive TTL via `chrome.alarms` (today the TTL is reactive —
  checked only on method calls).

Until M4.2 lands, engineers touching `ProfileService.restorePasswordSession`
(`src/wallet/services/profile/service.ts:531-570`) or `EncryptionKey`
(`src/wallet/services/profile/encryption/encryption-key.ts`) must not widen
the exposure of `passhash` beyond `chrome.storage.session`.

## Session secret (passkey profiles)

Passkey profiles **do not persist any session material**. When the service
worker restarts, the user must re-perform WebAuthn PRF to re-derive the
master secret. This is asymmetric with the password flow above and is
intentional: WebAuthn PRF already provides a secure re-auth surface, so there
is no reason to persist a bearer credential.

## Content script injection

The extension injects a content script on `*://*/*` at `document_start`,
`all_frames: true` (`manifest/manifest.config.ts`). This is broad by design
to support dApp discovery via `window.postMessage`, but it is a real attack
surface multiplier:

- Any bug in the `@aztec/wallet-sdk` `ContentScriptConnectionHandler` is
  exposed on every page.
- Nested iframes on matched sites get the bridge whether or not they will
  ever talk to the wallet.

Tracked for review in M4.1. If the product requirement for broad injection
is not explicit, the scope should be narrowed (dynamic registration for
active dApp sessions).

## Authorization enforcement

Two layers:

1. **Capability type** (`src/wallet/services/wallet-sdk/capability-map.ts`)
   — maps each wallet-sdk method to the capability type it requires
   (`accounts`, `transaction`, `simulation`, `data`, `contracts`,
   `contractClasses`).
2. **Per-operation scope** (`src/wallet/services/wallet-sdk/scope-enforcement.ts`)
   — validates that the specific contract/function targeted by an operation
   falls within the scope granted.

`createAuthWit` validates both the `from` account and, when the request
carries a `CallIntent`, the target call itself against transaction or
simulation scope. When it carries an `IntentInnerHash`, the `consumer`
contract is validated at wildcard function. Raw message hashes cannot be
validated beyond the account check (no semantic info).

## Storage privacy

Encrypted at rest:
- `profile.secret` — master secret (AES-GCM)
- `profile.guard` — password verification sentinel (AES-GCM)

Plaintext at rest (`chrome.storage.local`):
- Profile metadata, networks, accounts, contacts, dApp sessions, tokens,
  token balances, tx history, auth registry state, FPC definitions,
  config, storage version.

Expanding the encrypted boundary to cover profile-scoped metadata (contacts,
dApp sessions, tx history) is tracked as M4.11 — large refactor, not a
near-term patch.

## Reporting a vulnerability

Please open a private security advisory against the repository on GitHub.
Do not file public issues for security bugs.
