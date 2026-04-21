# 13 Risk Register

## Scope

This register captures the most concrete architectural and security-adjacent risks surfaced during the read.

Each item includes:

- evidence in the current code
- why it matters
- a concrete remediation
- delivery risk and size

Severity is my judgment from the code. Where the impact depends on unstated product assumptions, I call that out explicitly.

## R1. `createAuthWit` scope enforcement is incomplete

Severity: high

Evidence:

- [`packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts:192`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L192) through [`scope-enforcement.ts:204`](../../packages/extension/src/wallet/services/wallet-sdk/scope-enforcement.ts#L204)

The code checks that `createAuthWit` is requested for an allowed account, but it explicitly does not yet validate the target call scope when the authwit is created from a `CallIntent`.

Why it matters:

- an authwit is an authorization primitive, not just metadata
- if account-level permission exists but call-level scope is not enforced, a dApp may be able to obtain a witness broader than its granted transaction scope
- this is security-adjacent and should be treated as a real authorization gap until proven otherwise

Remediation:

- extend `checkCreateAuthWit()` to inspect `CallIntent.call.to` and `call.name`
- validate it against the same transaction or simulation scope model used for `sendTx` and `simulateTx`
- add explicit tests for allowed and denied target calls

Estimate:

- implementation risk: medium
- size: 1-2 days

## R2. Password session stores a password-equivalent bearer secret

Severity: high

Evidence:

- session restore path in [`packages/extension/src/wallet/services/profile/service.ts:531`](../../packages/extension/src/wallet/services/profile/service.ts#L531) through [`profile/service.ts:558`](../../packages/extension/src/wallet/services/profile/service.ts#L558)
- session write in [`profile/service.ts:560`](../../packages/extension/src/wallet/services/profile/service.ts#L560) through [`profile/service.ts:570`](../../packages/extension/src/wallet/services/profile/service.ts#L570)
- `EncryptionKey.fromPasshash()` directly imports the passhash as the PBKDF2 base key in [`packages/extension/src/wallet/services/profile/encryption/encryption-key.ts:87`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L87) through [`encryption-key.ts:90`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L90)

Inference:

- `session.passhash` is not merely a verifier
- it is sufficient to reconstruct the encryption key used to decrypt the stored profile secret

Why it matters:

- if a privileged extension context is compromised while the browser session is alive, the attacker does not need the user's original password
- the stored `passhash` is effectively a bearer credential for reopening the password profile

Remediation:

- stop persisting `passhash` directly
- persist either:
  - a session-wrapped secret derived from a device-local key, or
  - an encrypted session token that cannot itself decrypt profile storage
- if persistent unlock is required, treat it as a separate session credential with its own rotation/revocation rules

Estimate:

- implementation risk: high
- size: 4-7 days

## R3. Approval and passkey flows rely on in-memory maps that vanish on worker restart

Severity: high

Evidence:

- dApp approvals stored in memory in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:40`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L40) through [`dapp-interaction/service.ts:41`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L41)
- passkey requests stored in memory in [`packages/extension/src/wallet/services/passkey/service.ts:13`](../../packages/extension/src/wallet/services/passkey/service.ts#L13)
- tasks stored in memory in [`packages/extension/src/wallet/services/task/service.ts:31`](../../packages/extension/src/wallet/services/task/service.ts#L31) through [`task/service.ts:32`](../../packages/extension/src/wallet/services/task/service.ts#L32)

Why it matters:

- MV3 workers are ephemeral by design
- if the worker is suspended or restarted while an approval window or passkey window is open, the UI can come back with an invalid request id and no recoverable state
- long-running prove/send flows lose their task tree and approval context

Impact:

- user-facing failures
- unrecoverable approval windows
- difficult-to-debug support cases

Remediation:

- persist pending approval/passkey/task envelopes in session storage with TTL
- make popup windows resilient to worker restarts by reloading request state from storage
- keep only execution handles in memory

Estimate:

- implementation risk: medium
- size: 4-6 days

## R4. The content script is injected on every page, every frame, at `document_start`

Severity: high

Evidence:

- manifest entry in [`packages/extension/manifest/manifest.config.ts:25`](../../packages/extension/manifest/manifest.config.ts#L25) through [`manifest.config.ts:31`](../../packages/extension/manifest/manifest.config.ts#L31)

External context:

- Chrome's docs describe content scripts as code that runs in the context of web pages and can directly access runtime messaging and storage-related APIs. Source: [Chrome content scripts docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

Why it matters:

- this maximizes attack surface and performance footprint
- all iframes on all matched sites get the bridge code whether or not they will ever talk to the wallet
- any bug in the bridge or injected page coordination is exposed everywhere, not just on known dApp hosts

To be clear:

- a wallet often needs broad injection
- broad injection is not automatically wrong
- but it is a real risk multiplier and deserves compensating controls

Remediation:

- keep the broad match only if the product requirement is explicit
- otherwise move to dynamic registration for active/known dApp sessions where feasible
- minimize code in the static content script to the smallest possible bootstrap
- add abuse-oriented tests for nested frames and hostile page messaging

Estimate:

- implementation risk: medium
- size: 3-5 days for hardening, longer if moving to dynamic registration

## R5. In-flight transactions are not durably recorded until after `sendTx` succeeds

Severity: high

Evidence:

- transfer flow in [`packages/extension/src/wallet/services/execution/service.ts:305`](../../packages/extension/src/wallet/services/execution/service.ts#L305) through [`execution/service.ts:343`](../../packages/extension/src/wallet/services/execution/service.ts#L343)
- `TransactionService.addTransaction()` only starts after `sendTxTask()` returns in the same path
- popup optimism in [`packages/extension/src/popup/pages/send.vue:257`](../../packages/extension/src/popup/pages/send.vue#L257) through [`send.vue:297`](../../packages/extension/src/popup/pages/send.vue#L297)

Why it matters:

- proving and submission can be long-running
- if the worker dies between proving and durable transaction persistence, the wallet loses the operation history
- the UI may navigate away after 700ms assuming background continuity, while the durable record does not yet exist

Impact:

- user sees "Confirming..." then no persisted transaction
- support/debugging becomes difficult
- re-broadcast and reconciliation become ambiguous

Remediation:

- create a durable "pending operation" record before proof generation starts
- update it through states such as `planned`, `proving`, `submitting`, `submitted`
- reconcile the final tx hash into the durable record once available

Estimate:

- implementation risk: medium
- size: 3-5 days

## R6. Public contract registry becomes a trust root when enabled

Severity: medium

Evidence:

- remote fetch path in [`packages/extension/src/wallet/services/pxe/service.ts:426`](../../packages/extension/src/wallet/services/pxe/service.ts#L426) through [`pxe/service.ts:460`](../../packages/extension/src/wallet/services/pxe/service.ts#L460)

Uncertainty:

- I did not trace every downstream callsite to confirm whether fetched artifacts are later revalidated against the requested class id
- the risk here is the trust model, which is explicit even if later validation reduces impact

Why it matters:

- once `contractRegistry` is enabled, remote HTTPS endpoints supply artifacts used by the wallet
- those endpoints are effectively part of the wallet's trust boundary
- if they are compromised or serve stale/wrong data, the wallet can make incorrect assumptions about contracts

Remediation:

- verify fetched artifacts deterministically against the requested class id before use
- pin registry domains in config with environment-aware allowlists
- add signature or content-address verification if the registry is intended for production trust

Estimate:

- implementation risk: medium
- size: 2-4 days

## R7. Popup creation failure can leave approval promises unresolved

Severity: medium

Evidence:

- dApp interaction popup creation in [`packages/extension/src/wallet/services/dapp-interaction/service.ts:173`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L173) through [`dapp-interaction/service.ts:195`](../../packages/extension/src/wallet/services/dapp-interaction/service.ts#L195)
- passkey popup creation in [`packages/extension/src/wallet/services/passkey/service.ts:59`](../../packages/extension/src/wallet/services/passkey/service.ts#L59) through [`passkey/service.ts:89`](../../packages/extension/src/wallet/services/passkey/service.ts#L89)

Both callbacks early-return if `createdWindow?.id` is absent, but neither path rejects the stored promise.

Why it matters:

- a failed popup create becomes an unbounded pending request
- callers can hang without a definitive error
- memory entries remain until some other path clears them

Remediation:

- reject immediately if `chrome.runtime.lastError` exists or `createdWindow?.id` is missing
- add a hard timeout for all popup-backed approvals
- persist terminal failure state for the popup UI to display

Estimate:

- implementation risk: low
- size: less than 1 day

## R8. Offscreen requests can be lost silently if the worker dies mid-response

Severity: medium

Evidence:

- offscreen service comment and catch in [`packages/extension/src/wallet/base/offscreen/service.ts:97`](../../packages/extension/src/wallet/base/offscreen/service.ts#L97) through [`offscreen/service.ts:103`](../../packages/extension/src/wallet/base/offscreen/service.ts#L103)
- client timeout path in [`packages/extension/src/wallet/base/offscreen/client.ts:112`](../../packages/extension/src/wallet/base/offscreen/client.ts#L112) through [`offscreen/client.ts:120`](../../packages/extension/src/wallet/base/offscreen/client.ts#L120)

Why it matters:

- the client eventually rejects, but only after 90 seconds
- during that time the UI may look stalled and the underlying result is lost
- events emitted from offscreen can also be lost if the worker is down

Remediation:

- move long-running PXE calls behind durable operation ids
- let the worker recover and resume from stored operation state
- surface a shorter user-facing timeout with retry/resume semantics

Estimate:

- implementation risk: medium
- size: 3-5 days for user-visible hardening, longer for full resumability

## R9. Service startup ordering is implicit and race-prone

Severity: medium

Evidence:

- `ServiceCollection.start()` runs `Promise.all(...)` in [`packages/extension/src/wallet/base/index.ts:43`](../../packages/extension/src/wallet/base/index.ts#L43) through [`base/index.ts:45`](../../packages/extension/src/wallet/base/index.ts#L45)
- services then poll `ensureInitialized()` for up to 30 seconds in:
  - [`packages/extension/src/wallet/base/background/service.ts:124`](../../packages/extension/src/wallet/base/background/service.ts#L124) through [`background/service.ts:136`](../../packages/extension/src/wallet/base/background/service.ts#L136)
  - [`packages/extension/src/wallet/base/offscreen/service.ts:122`](../../packages/extension/src/wallet/base/offscreen/service.ts#L122) through [`offscreen/service.ts:133`](../../packages/extension/src/wallet/base/offscreen/service.ts#L122)

Why it matters:

- init dependencies are real, but startup order is implicit
- failures can manifest as timeouts or long polling delays rather than clear dependency errors
- this increases cold-start fragility

Remediation:

- replace `Promise.all` startup with explicit phase ordering
- or declare service dependency graphs and topologically start them
- fail fast with named dependency errors rather than sleep/poll loops

Estimate:

- implementation risk: medium
- size: 2-4 days

## R10. Passkey RP ID is hardcoded to `nulo.sh`

Severity: medium

Evidence:

- creation path in [`packages/extension/src/popup/windows/passkey/index.vue:35`](../../packages/extension/src/popup/windows/passkey/index.vue#L35) through [`passkey/index.vue:41`](../../packages/extension/src/popup/windows/passkey/index.vue#L41)
- get path in [`passkey/index.vue:85`](../../packages/extension/src/popup/windows/passkey/index.vue#L85) through [`passkey/index.vue:92`](../../packages/extension/src/popup/windows/passkey/index.vue#L92)
- manifest host permission in [`packages/extension/manifest/manifest.config.ts:14`](../../packages/extension/manifest/manifest.config.ts#L14)

Why it matters:

- passkeys are cryptographically bound to that RP ID
- any white-label build, staging domain change, or future domain migration becomes a credential-compatibility event
- operationally, this is a sharp edge hidden in product configuration

Remediation:

- make RP ID an explicit build-time/runtime contract, not a hidden constant
- gate production builds so RP ID and host permissions must match
- document migration/recovery implications before shipping alternative brands/domains

Estimate:

- implementation risk: medium
- size: 1-2 days

## R11. Same-chain RPC variants share one PXE data directory per profile

Severity: medium

Evidence:

- same-chain cache keying in [`packages/extension/src/wallet/services/pxe/service.ts:393`](../../packages/extension/src/wallet/services/pxe/service.ts#L393) through [`pxe/service.ts:410`](../../packages/extension/src/wallet/services/pxe/service.ts#L410)
- PXE data dir uses `pxe/${network.profileId}/${network.chainId}` in [`pxe/service.ts:399`](../../packages/extension/src/wallet/services/pxe/service.ts#L399) through [`pxe/service.ts:406`](../../packages/extension/src/wallet/services/pxe/service.ts#L406)

Why it matters:

- if a profile uses two different RPC endpoints for the same chain id, the service recreates the PXE client when `rpcUrl` changes
- but the persisted data directory remains keyed only by `profileId` and `chainId`
- that means different RPC backends for the same chain share one local PXE DB

Uncertainty:

- I did not run a live experiment to prove corruption or inconsistency
- the persistence key design is nevertheless a real coupling point

Remediation:

- key PXE persistence by stable network id or a hash of `(profileId, chainId, rpcUrl)`
- define migration behavior for old DB names

Estimate:

- implementation risk: medium
- size: 2-3 days

## R12. `getAddressBook` leaks across chains because chain filtering is missing

Severity: medium

Evidence:

- explicit TODO in [`packages/extension/src/wallet/services/execution/service.ts:1086`](../../packages/extension/src/wallet/services/execution/service.ts#L1086) through [`execution/service.ts:1091`](../../packages/extension/src/wallet/services/execution/service.ts#L1091)

Why it matters:

- dApps calling the Aztec address-book method can receive contacts without chain scoping
- that is a data-minimization issue
- it can also create UX confusion if names exist for addresses irrelevant to the active chain

Remediation:

- make contacts chain-aware if the product model requires it
- otherwise explicitly document that the address book is chain-agnostic and rename the API contract to match

Estimate:

- implementation risk: low
- size: 1-2 days

## R13. Default network and registry endpoints are hardcoded

Severity: low to medium

Evidence:

- default RPCs in [`packages/extension/src/wallet/services/network/service.ts:53`](../../packages/extension/src/wallet/services/network/service.ts#L53) through [`network/service.ts:85`](../../packages/extension/src/wallet/services/network/service.ts#L85)
- hardcoded registry URLs in [`packages/extension/src/wallet/services/pxe/service.ts:452`](../../packages/extension/src/wallet/services/pxe/service.ts#L452) through [`pxe/service.ts:460`](../../packages/extension/src/wallet/services/pxe/service.ts#L460)

Why it matters:

- endpoint churn requires a release
- environment behavior is partly encoded in source rather than config
- support incidents become code deployments rather than config changes

Remediation:

- move default network definitions and registry base URLs behind typed config with environment profiles
- keep compile-time defaults, but make them explicit and overrideable

Estimate:

- implementation risk: low
- size: 1-2 days

## R14. Rare passkey profile id collision can desynchronize profile id and credential userHandle

Severity: low

Evidence:

- id chosen before credential creation in [`packages/extension/src/wallet/services/profile/service.ts:156`](../../packages/extension/src/wallet/services/profile/service.ts#L156) through [`profile/service.ts:165`](../../packages/extension/src/wallet/services/profile/service.ts#L165)
- id may change under the lock afterward in [`profile/service.ts:167`](../../packages/extension/src/wallet/services/profile/service.ts#L167) through [`profile/service.ts:171`](../../packages/extension/src/wallet/services/profile/service.ts#L171)

Why it matters:

- the credential is created using the pre-lock `userHandle`
- if the id is changed after a collision check under lock, the stored profile id and the credential's `userHandle` can diverge
- this appears unlikely, but it is a real logic footgun

Remediation:

- allocate the final profile id before WebAuthn creation, using a reservation step
- or retry the whole flow if the id collides after lock acquisition

Estimate:

- implementation risk: low
- size: less than 1 day

## Bottom line

The highest-value risks are:

1. incomplete authwit scope enforcement
2. password-equivalent session material in storage
3. in-memory-only approval and long-running operation state
4. broad static page injection surface
5. weak durability for in-flight transaction state

Those are the items I would address before calling the extension production-hardened.
