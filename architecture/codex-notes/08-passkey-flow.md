# 08 Passkey Flow

## Scope

This note documents how passkeys are used for:

- first-time passkey-backed profile creation
- passkey unlock
- passkey-gated confirmation for sensitive actions
- passkey import / backup / restore semantics

It is based on the real popup registration and auth flows, `PasskeyService`, `PasskeyCredential`, and `ProfileService`.

## Architectural summary

The passkey stack is intentionally narrow:

- the worker owns pending passkey requests in `PasskeyService`
- the popup opens a dedicated passkey window for WebAuthn interaction
- the passkey window performs WebAuthn PRF evaluation against RP ID `nulo.sh`
- the PRF output is not stored directly; it is run through HKDF to derive the wallet’s 32-byte master secret
- `ProfileService` treats that derived secret as the profile’s root secret exactly like the decrypted password profile secret

The big architectural distinction versus password profiles is:

- password profiles persist an encrypted secret in `nulo:core:profiles`
- passkey profiles persist only `credentialId`
- the secret must be re-derived from WebAuthn whenever the profile is unlocked

## Passkey creation flow

### Entry from registration UI

The register popup lets the user choose between password and passkey-backed profiles in [`packages/extension/src/popup/components/popups/RegisterPopup/RegisterPopup.vue:27`](../../packages/extension/src/popup/components/popups/RegisterPopup/RegisterPopup.vue#L27) through [`RegisterPopup.vue:44`](../../packages/extension/src/popup/components/popups/RegisterPopup/RegisterPopup.vue#L44).

When the selected type is `passkey`, profile creation calls:

- `managers.profile.createPasskeyProfile(name)` in [`RegisterPopup.vue:72`](../../packages/extension/src/popup/components/popups/RegisterPopup/RegisterPopup.vue#L72) through [`RegisterPopup.vue:75`](../../packages/extension/src/popup/components/popups/RegisterPopup/RegisterPopup.vue#L75)

### Worker-side creation

`ProfileService.createPasskeyProfile(...)` performs the main flow in [`packages/extension/src/wallet/services/profile/service.ts:156`](../../packages/extension/src/wallet/services/profile/service.ts#L156):

1. generate a profile ID candidate with `getRandomHex(8)` in [`profile/service.ts:158`](../../packages/extension/src/wallet/services/profile/service.ts#L158) through [`profile/service.ts:162`](../../packages/extension/src/wallet/services/profile/service.ts#L162)
2. request a new WebAuthn credential through `this.passkeys.createKey(id)` in [`profile/service.ts:163`](../../packages/extension/src/wallet/services/profile/service.ts#L163)
3. derive the master secret from the resulting credential in [`profile/service.ts:164`](../../packages/extension/src/wallet/services/profile/service.ts#L164)
4. persist a passkey profile containing `{ id, name, type: "passkey", credentialId }` in [`profile/service.ts:173`](../../packages/extension/src/wallet/services/profile/service.ts#L173) through [`profile/service.ts:179`](../../packages/extension/src/wallet/services/profile/service.ts#L179)
5. open a session with the derived secret in [`profile/service.ts:183`](../../packages/extension/src/wallet/services/profile/service.ts#L183)

Unlike password profiles, no encrypted profile secret is stored.

### Passkey request plumbing

`PasskeyService.createKey(...)` and `getKey(...)` both route through `openWindowAndWait(...)` in [`packages/extension/src/wallet/services/passkey/service.ts:19`](../../packages/extension/src/wallet/services/passkey/service.ts#L19) through [`passkey/service.ts:25`](../../packages/extension/src/wallet/services/passkey/service.ts#L25) and [`passkey/service.ts:50`](../../packages/extension/src/wallet/services/passkey/service.ts#L50) through [`passkey/service.ts:88`](../../packages/extension/src/wallet/services/passkey/service.ts#L88).

That method:

- generates a request ID
- stores a pending promise in an in-memory `Map<string, PasskeyRequestPromise>`
- opens `src/popup/index.html#/windows/passkey?requestId=...`
- rejects if the window is closed before resolution

So passkey operations are asynchronous popup workflows, not direct worker WebAuthn calls.

### WebAuthn create call

The actual credential creation happens in the passkey popup window in [`packages/extension/src/popup/windows/passkey/index.vue:27`](../../packages/extension/src/popup/windows/passkey/index.vue#L27) through [`passkey/index.vue:78`](../../packages/extension/src/popup/windows/passkey/index.vue#L78).

The critical WebAuthn properties are:

- RP ID is hard-coded to `nulo.sh` in [`passkey/index.vue:35`](../../packages/extension/src/popup/windows/passkey/index.vue#L35) through [`passkey/index.vue:41`](../../packages/extension/src/popup/windows/passkey/index.vue#L41)
- user handle is the profile ID encoded as bytes in [`passkey/index.vue:32`](../../packages/extension/src/popup/windows/passkey/index.vue#L32)
- resident key is required in [`passkey/index.vue:48`](../../packages/extension/src/popup/windows/passkey/index.vue#L48) through [`passkey/index.vue:52`](../../packages/extension/src/popup/windows/passkey/index.vue#L52)
- user verification is required in both create and get flows in [`passkey/index.vue:49`](../../packages/extension/src/popup/windows/passkey/index.vue#L49) and [`passkey/index.vue:89`](../../packages/extension/src/popup/windows/passkey/index.vue#L89)
- timeout is `3 minutes` via `PASSKEY_TIMEOUT` in [`packages/extension/src/wallet/services/passkey/spec.ts:5`](../../packages/extension/src/wallet/services/passkey/spec.ts#L5)
- PRF is requested with `extensions.prf.eval.first = SHA-256(PASSKEY_PRF_LABEL)` in [`passkey/index.vue:30`](../../packages/extension/src/popup/windows/passkey/index.vue#L30) through [`passkey/index.vue:31`](../../packages/extension/src/popup/windows/passkey/index.vue#L31) and [`passkey/index.vue:55`](../../packages/extension/src/popup/windows/passkey/index.vue#L55)

If PRF is enabled during creation, the popup immediately resolves the worker request with `{ credentialId, prf, userHandle }` in [`passkey/index.vue:63`](../../packages/extension/src/popup/windows/passkey/index.vue#L63) through [`passkey/index.vue:73`](../../packages/extension/src/popup/windows/passkey/index.vue#L73).

If PRF is not returned on creation, the code immediately falls back to a `get()` assertion against the newly created credential in [`passkey/index.vue:74`](../../packages/extension/src/popup/windows/passkey/index.vue#L74) through [`passkey/index.vue:76`](../../packages/extension/src/popup/windows/passkey/index.vue#L76).

## Passkey unlock flow

### Auth page entry

The lock screen chooses passkey unlock when the selected profile is passkey-backed:

- `isPasskeyProfile` is computed from `appStore.profile.type` in [`packages/extension/src/popup/pages/auth.vue:36`](../../packages/extension/src/popup/pages/auth.vue#L36)
- `handleUnlockWallet()` calls `managers.profile.unlockPasskeyProfile(appStore.profile.id)` in [`auth.vue:54`](../../packages/extension/src/popup/pages/auth.vue#L54) through [`auth.vue:60`](../../packages/extension/src/popup/pages/auth.vue#L60)

### Worker-side unlock

`ProfileService.unlockPasskeyProfile(...)` in [`packages/extension/src/wallet/services/profile/service.ts:191`](../../packages/extension/src/wallet/services/profile/service.ts#L191):

1. loads the stored profile by ID
2. verifies the profile type is `passkey`
3. requires `credentialId`
4. calls `this.passkeys.getKey(profile.credentialId)` in [`profile/service.ts:203`](../../packages/extension/src/wallet/services/profile/service.ts#L203) through [`profile/service.ts:208`](../../packages/extension/src/wallet/services/profile/service.ts#L208)
5. derives the master secret from the returned PRF output
6. opens a session with that secret in [`profile/service.ts:210`](../../packages/extension/src/wallet/services/profile/service.ts#L210)

Again, no secret is decrypted from storage; the secret is regenerated from WebAuthn.

### WebAuthn get call

The `get()` path in the passkey popup is implemented in [`passkey/index.vue:80`](../../packages/extension/src/popup/windows/passkey/index.vue#L80) through [`passkey/index.vue:114`](../../packages/extension/src/popup/windows/passkey/index.vue#L114).

Important details:

- it uses the same RP ID `nulo.sh` as creation in [`passkey/index.vue:85`](../../packages/extension/src/popup/windows/passkey/index.vue#L85) through [`passkey/index.vue:89`](../../packages/extension/src/popup/windows/passkey/index.vue#L89)
- if a stored credential ID is known, it restricts `allowCredentials` to that ID in [`passkey/index.vue:93`](../../packages/extension/src/popup/windows/passkey/index.vue#L93) through [`passkey/index.vue:96`](../../packages/extension/src/popup/windows/passkey/index.vue#L96)
- it requires PRF output and returns both credential ID and `userHandle` if the authenticator exposes it in [`passkey/index.vue:100`](../../packages/extension/src/popup/windows/passkey/index.vue#L100) through [`passkey/index.vue:113`](../../packages/extension/src/popup/windows/passkey/index.vue#L113)

## KDF chain and labels

There are three passkey-specific domain-separation labels in play:

1. `PASSKEY_PRF_LABEL = "nulo:profile:v1"` in [`packages/extension/src/wallet/services/passkey/spec.ts:4`](../../packages/extension/src/wallet/services/passkey/spec.ts#L4)
2. `PASSKEY_KDF_LABEL = "nulo:kdf:v1"` in [`packages/extension/src/wallet/services/passkey/credential.ts:8`](../../packages/extension/src/wallet/services/passkey/credential.ts#L8)
3. `PASSKEY_MASTER_LABEL = "nulo:master:v1"` in [`credential.ts:9`](../../packages/extension/src/wallet/services/passkey/credential.ts#L9)

The derivation sequence is:

1. Hash `PASSKEY_PRF_LABEL` with SHA-256 and pass it as the WebAuthn PRF input in [`passkey/index.vue:30`](../../packages/extension/src/popup/windows/passkey/index.vue#L30) through [`passkey/index.vue:31`](../../packages/extension/src/popup/windows/passkey/index.vue#L31)
2. Receive PRF output from the authenticator as `params.prf`
3. In `PasskeyCredential.create(...)`, import that PRF output as HKDF input keying material in [`credential.ts:24`](../../packages/extension/src/wallet/services/passkey/credential.ts#L24) through [`credential.ts:30`](../../packages/extension/src/wallet/services/passkey/credential.ts#L30)
4. Compute salt as `SHA-256(PASSKEY_KDF_LABEL || credentialId)` in [`credential.ts:26`](../../packages/extension/src/wallet/services/passkey/credential.ts#L26) through [`credential.ts:29`](../../packages/extension/src/wallet/services/passkey/credential.ts#L29)
5. Derive 256 bits with HKDF info `PASSKEY_MASTER_LABEL` in [`credential.ts:33`](../../packages/extension/src/wallet/services/passkey/credential.ts#L33) through [`credential.ts:38`](../../packages/extension/src/wallet/services/passkey/credential.ts#L38)
6. Reduce those bytes into an Aztec `Fr` and use its 32-byte buffer as the master secret in [`credential.ts:39`](../../packages/extension/src/wallet/services/passkey/credential.ts#L39) through [`credential.ts:40`](../../packages/extension/src/wallet/services/passkey/credential.ts#L40)

This is a sensible domain-separated design. The labels are compatibility-critical.

## Session behavior

Passkey profiles participate in the same `ProfileService` session model as password profiles, but with one important difference:

- password sessions can be restored from `chrome.storage.session` because `session.passhash` is persisted and `restorePasswordSession(...)` exists in [`packages/extension/src/wallet/services/profile/service.ts:531`](../../packages/extension/src/wallet/services/profile/service.ts#L531)
- passkey sessions have no equivalent restore path

`ProfileService.init(...)` explicitly restores only password sessions in [`profile/service.ts:68`](../../packages/extension/src/wallet/services/profile/service.ts#L68) through [`profile/service.ts:70`](../../packages/extension/src/wallet/services/profile/service.ts#L70).

So if the worker dies, a passkey profile must perform WebAuthn again to re-enter the session.

## Confirmation for sensitive actions

Sensitive operations can require passkey confirmation through `ProfileService.confirmProfileOperation(...)` in [`packages/extension/src/wallet/services/profile/service.ts:318`](../../packages/extension/src/wallet/services/profile/service.ts#L318) through [`profile/service.ts:362`](../../packages/extension/src/wallet/services/profile/service.ts#L362).

For passkey profiles, confirmation is simply:

- ensure `credentialId` exists
- run `this.passkeys.getKey(profile.credentialId)`

The code does not derive or compare any secret here; the existence of a successful WebAuthn assertion is treated as confirmation.

## Import, backup, and restore semantics

### Importing an existing passkey profile

`ProfileService.importPasskey(...)` is a “reattach this authenticator” flow, not a secret-import flow:

- it calls `this.passkeys.getKey()` without specifying a credential ID in [`packages/extension/src/wallet/services/profile/service.ts:218`](../../packages/extension/src/wallet/services/profile/service.ts#L218) through [`profile/service.ts:223`](../../packages/extension/src/wallet/services/profile/service.ts#L223)
- then creates a passkey profile from the returned `credential.id`, derived secret, and `userHandle`

The import popup calls this from [`packages/extension/src/popup/components/popups/ImportPopup.vue:182`](../../packages/extension/src/popup/components/popups/ImportPopup.vue#L182) through [`ImportPopup.vue:186`](../../packages/extension/src/popup/components/popups/ImportPopup.vue#L186).

If the authenticator exposes the original user handle, the imported profile reuses that as the profile ID in [`profile/service.ts:602`](../../packages/extension/src/wallet/services/profile/service.ts#L602) through [`profile/service.ts:630`](../../packages/extension/src/wallet/services/profile/service.ts#L630).

### Export semantics for passkey profiles

For passkey profiles, `exportPlain(...)` does **not** return the master secret. It returns `profile.credentialId` in [`packages/extension/src/wallet/services/profile/service.ts:443`](../../packages/extension/src/wallet/services/profile/service.ts#L443) through [`profile/service.ts:452`](../../packages/extension/src/wallet/services/profile/service.ts#L452).

The full-backup screen stores this as `"master-key"` in the backup JSON in [`packages/extension/src/popup/pages/settings/security/export/full.vue:97`](../../packages/extension/src/popup/pages/settings/security/export/full.vue#L97) through [`export/full.vue:103`](../../packages/extension/src/popup/pages/settings/security/export/full.vue#L103).

The UI copy correctly hints at the real recovery model:

- passkey backups require the passkey to be synced or available on another owned device in [`packages/extension/src/popup/pages/settings/security/export/index.vue:41`](../../packages/extension/src/popup/pages/settings/security/export/index.vue#L41) through [`export/index.vue:45`](../../packages/extension/src/popup/pages/settings/security/export/index.vue#L45)

### Restore semantics for passkey profiles

`ProfileService.restore(...)` treats passkey profile restore as:

1. call `this.passkeys.getKey(masterKey)` where `masterKey` is really the backed-up credential ID in [`packages/extension/src/wallet/services/profile/service.ts:721`](../../packages/extension/src/wallet/services/profile/service.ts#L721) through [`profile/service.ts:724`](../../packages/extension/src/wallet/services/profile/service.ts#L724)
2. derive the same secret again from WebAuthn
3. rebuild a passkey profile entry with the recovered credential ID in [`profile/service.ts:738`](../../packages/extension/src/wallet/services/profile/service.ts#L738) through [`profile/service.ts:743`](../../packages/extension/src/wallet/services/profile/service.ts#L743)

So recovery depends on the authenticator ecosystem, not on a local escrowed secret.

## What is good

- The KDF chain is explicit and domain-separated.
- RP ID usage is consistent between create and get.
- Passkey-backed profiles avoid storing encrypted long-term secrets in profile storage.
- The code already handles the PRF-on-create compatibility edge case by falling back to an immediate assertion.
- Backup UI text for passkey profiles reflects the actual recovery constraint instead of pretending there is a mnemonic.

## Current pressure points

1. Pending passkey requests are memory-only.
`PasskeyService.pending` is an in-memory map in [`packages/extension/src/wallet/services/passkey/service.ts:13`](../../packages/extension/src/wallet/services/passkey/service.ts#L13). A worker restart during passkey interaction loses the request context.

2. Passkey sessions are not restart-restorable.
Only password sessions are restored from session storage. Passkey users re-authenticate after worker restart even within the session TTL window.

3. RP ID is hard-coded in UI code.
`nulo.sh` lives directly inside the passkey popup in [`passkey/index.vue:40`](../../packages/extension/src/popup/windows/passkey/index.vue#L40) and [`passkey/index.vue:88`](../../packages/extension/src/popup/windows/passkey/index.vue#L88), not in a single shared config source.

4. Rare ID collision handling can desynchronize profile ID and passkey user handle.
`createPasskeyProfile(...)` generates an ID before opening the passkey window, but if that ID collides later under lock it changes the profile ID in [`profile/service.ts:168`](../../packages/extension/src/wallet/services/profile/service.ts#L168) through [`profile/service.ts:171`](../../packages/extension/src/wallet/services/profile/service.ts#L171) without regenerating the credential’s user handle. The collision risk is low, but the mismatch is real if it happens.

5. Export naming is misleading for passkey profiles.
The full-backup JSON stores `credentialId` under the field name `"master-key"` in [`export/full.vue:101`](../../packages/extension/src/popup/pages/settings/security/export/full.vue#L101). That is accurate for password profiles, but semantically wrong for passkey profiles.

6. Confirmation flow checks possession, not secret continuity.
`confirmProfileOperation(...)` for passkey profiles only ensures WebAuthn succeeds. That may be fine, but it is a different security property than “prove you can derive the same master secret.”

## Recommendations flowing from this concern

1. Persist minimal pending passkey request descriptors.
Risk: medium. Size: days.
Store `{ requestId, mode, credentialId?, userHandle? }` so a restarted worker can fail or recover the popup flow cleanly.

2. Add a passkey session-resume design explicitly.
Risk: medium. Size: days.
Either accept “always re-prompt after worker restart” as a documented product constraint or add a resumable short-lived authenticated state for passkey users.

3. Centralize RP ID and passkey labels in one config module.
Risk: low. Size: hours.
The compatibility-critical constants should not be duplicated across UI and worker-adjacent code paths.

4. Fix the profile ID / user handle collision edge case.
Risk: low. Size: hours.
Reserve the profile ID under lock before launching WebAuthn, or regenerate the credential if the reserved ID changes.

5. Rename passkey backup fields and UI copy to match reality.
Risk: low. Size: hours.
For passkey profiles, store `credential-id` or `passkey-credential-id` instead of `master-key` to avoid false assumptions during restore tooling.

6. Decide whether sensitive confirmations should also re-derive and verify the secret.
Risk: medium. Size: hours to days.
If the current possession-only semantics are intended, document them. If not, tighten `confirmProfileOperation(...)` to derive the credential-backed secret explicitly.
