# 04 Storage And Crypto

## Scope

This note covers:

- `EntityStorage` / `ValueStorage` / `SimpleStorage`
- storage namespaces actually used by the extension
- profile secret persistence and session persistence
- password and passkey key derivation paths
- migration behavior and storage-version handling

## Storage primitives

There are three storage wrappers under `src/wallet/storage/`:

### `EntityStorage<T>`

[`packages/extension/src/wallet/storage/entity_storage.ts`](../../packages/extension/src/wallet/storage/entity_storage.ts#L1)

- Stores each entity as `root@id` in `chrome.storage.local` or `chrome.storage.session`
- Values are serialized as JSON strings in [`entity_storage.ts:36`](../../packages/extension/src/wallet/storage/entity_storage.ts#L36)
- Reads enumerate the whole storage area and filter by prefix in [`entity_storage.ts:44`](../../packages/extension/src/wallet/storage/entity_storage.ts#L44)

This is the real backing store for almost all persisted wallet state.

### `ValueStorage<T>`

[`packages/extension/src/wallet/storage/value-storage.ts`](../../packages/extension/src/wallet/storage/value-storage.ts#L1)

- Stores one JSON value at a single root key
- Used for config and session state

### `SimpleStorage<T>`

[`packages/extension/src/wallet/storage/simple_storage.ts`](../../packages/extension/src/wallet/storage/simple_storage.ts#L1)

- Stores values as `root:key`
- Not used anywhere in `src/` today

This looks like dead abstraction. It is part of the storage surface area, but not part of the actual architecture.

## Real storage namespaces

Current persisted namespaces, based on live constructor calls in the codebase:

| Root key | Storage area | Owner | Contents |
| --- | --- | --- | --- |
| `nulo:config` | local | [`ConfigStore`](../../packages/extension/src/wallet/config/store.ts#L10) | UI/privacy/developer config |
| `nulo:core:profiles` | local | [`ProfileService`](../../packages/extension/src/wallet/services/profile/service.ts#L44) | profile records |
| `nulo:core:session` | session | [`ProfileService`](../../packages/extension/src/wallet/services/profile/service.ts#L45) | active session metadata |
| `nulo:core:networks` | local | [`NetworkService`](../../packages/extension/src/wallet/services/network/service.ts#L23) | RPC endpoints and defaults |
| `nulo:core:accounts` | local | [`AccountService`](../../packages/extension/src/wallet/services/account/service.ts#L22) | derived account metadata |
| `nulo:core:contacts` | local | [`ContactService`](../../packages/extension/src/wallet/services/contact/service.ts#L21) | contact book |
| `nulo:core:dappSessions` | local | [`DappSessionService`](../../packages/extension/src/wallet/services/dapp-session/service.ts#L29) | dApp sessions/capabilities |
| `nulo:core:tokens` | local | [`TokenService`](../../packages/extension/src/wallet/services/token/service.ts#L39) | token interface definitions |
| `nulo:core:token-balances` | local | [`TokenBalanceService`](../../packages/extension/src/wallet/services/token-balance/service.ts#L31) | materialized balances |
| `nulo:core:txs` | local | [`TransactionService`](../../packages/extension/src/wallet/services/transaction/service.ts#L36) | tx history |
| `nulo:core:auth-registry` | local | [`AuthRegistryService`](../../packages/extension/src/wallet/services/auth-registry/service.ts#L28) | tracked public authwits |
| `nulo:core:auth-registry-enabled` | local | [`AuthRegistryService`](../../packages/extension/src/wallet/services/auth-registry/service.ts#L29) | local registry-enabled shadow state |
| `nulo:core:fpcs` | local | [`FpcService`](../../packages/extension/src/wallet/services/fpc/service.ts#L33) | fee-payment contract registry |
| `nulo:core:storage-version` | local | [`runStorageMigration`](../../packages/extension/src/wallet/storage/migrate.ts#L10) | coarse migration gate |

### Important read

Everything above is plaintext JSON in extension storage except the encrypted profile secret and password guard inside profile rows.

That means:

- networks
- contacts
- tokens
- tx metadata
- dApp sessions
- auth registry cache
- FPC definitions

are all persisted unencrypted.

This is not automatically wrong for an extension, but it is the actual confidentiality boundary today.

## Storage model characteristics

### 1. Prefix-scanned key-value store, not a database

Every `getAll()` / `getValues()` call on `EntityStorage` fetches the full storage area and filters by key prefix in [`entity_storage.ts:44`](../../packages/extension/src/wallet/storage/entity_storage.ts#L44).

Implications:

- no indexes
- no pagination
- no atomic multi-entity transactions
- no schema enforcement
- no concurrency control beyond higher-level `Lock` usage in services

### 2. JSON string payloads everywhere

The storage wrappers stringify every value manually. There is no use of Chrome structured clone. That keeps behavior predictable, but it also means:

- rich runtime types are flattened
- migrations must be handwritten
- invalid JSON in storage would fail at read time

### 3. Versioning exists in two places, but only one is used

`EntityStorage` exposes `getVersion()` / `setVersion()` in [`entity_storage.ts:12`](../../packages/extension/src/wallet/storage/entity_storage.ts#L12), but nothing calls them.

The actual migration gate is the global key in [`packages/extension/src/wallet/storage/migrate.ts:10`](../../packages/extension/src/wallet/storage/migrate.ts#L10).

That means per-collection versioning is currently dead API.

## Profile secret and master key lifecycle

The wallet’s root secret is a 32-byte value represented in memory as `Fr`.

### Password-backed profiles

Creation path:

- password → `SHA-256(password)` in [`packages/extension/src/wallet/services/profile/encryption/encryption-key.ts:97`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L97)
- that digest becomes the PBKDF2 base key in [`encryption-key.ts:87`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L87)
- a random 32-byte profile secret is generated in [`packages/extension/src/wallet/services/profile/service.ts:95`](../../packages/extension/src/wallet/services/profile/service.ts#L95)
- the service stores:
  - encrypted `ENCRYPTION_GUARD`
  - encrypted secret
  in [`profile/service.ts:105`](../../packages/extension/src/wallet/services/profile/service.ts#L105)

Encryption details:

- PBKDF2-SHA256 with `600_000` iterations in [`encryption-key.ts:1`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L1)
- AES-GCM-256 derived from the password base key and a salt computed as `SHA-256(iv)` in [`encryption-key.ts:11`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L11) and [`encryption-key.ts:35`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L35)
- ciphertext format is `[version byte][12-byte iv][ciphertext...]` in [`encryption-key.ts:41`](../../packages/extension/src/wallet/services/profile/encryption/encryption-key.ts#L41)

Password verification is not stored as a separate hash record. Instead, the code decrypts the encrypted guard and compares it to `ENCRYPTION_GUARD` in [`profile/service.ts:139`](../../packages/extension/src/wallet/services/profile/service.ts#L139).

### Passkey-backed profiles

The passkey path is different:

- the popup passkey window asks WebAuthn PRF for output using `PASSKEY_PRF_LABEL = "nulo:profile:v1"` in [`packages/extension/src/popup/windows/passkey/index.vue:31`](../../packages/extension/src/popup/windows/passkey/index.vue#L31) and [`packages/extension/src/wallet/services/passkey/spec.ts:4`](../../packages/extension/src/wallet/services/passkey/spec.ts#L4)
- `PasskeyCredential.create()` uses that PRF output as HKDF input material in [`packages/extension/src/wallet/services/passkey/credential.ts:24`](../../packages/extension/src/wallet/services/passkey/credential.ts#L24)
- the HKDF salt is `SHA-256("nulo:kdf:v1" || credentialId)` in [`credential.ts:8`](../../packages/extension/src/wallet/services/passkey/credential.ts#L8) and [`credential.ts:27`](../../packages/extension/src/wallet/services/passkey/credential.ts#L27)
- master-secret bits are derived with HKDF info `"nulo:master:v1"` in [`credential.ts:33`](../../packages/extension/src/wallet/services/passkey/credential.ts#L33)
- the derived bits are reduced into an `Fr` and serialized to 32 bytes in [`credential.ts:39`](../../packages/extension/src/wallet/services/passkey/credential.ts#L39)

Stored passkey profile data contains only:

- profile id
- name
- type
- `credentialId`

See [`profile/service.ts:173`](../../packages/extension/src/wallet/services/profile/service.ts#L173) and [`profile/service.ts:622`](../../packages/extension/src/wallet/services/profile/service.ts#L622).

No encrypted copy of the master secret is stored for passkey profiles.

## Session persistence

### What is stored

Opening a session writes:

- `profile`
- optional `passhash`
- `since`

to `chrome.storage.session` in [`profile/service.ts:562`](../../packages/extension/src/wallet/services/profile/service.ts#L562).

At the same time, the service caches the live secret in memory as `activeSession.secret` in [`profile/service.ts:568`](../../packages/extension/src/wallet/services/profile/service.ts#L568).

### Password session behavior

Password sessions are recoverable after worker restart:

- `ProfileService.init()` reads `nulo:core:session` in [`profile/service.ts:53`](../../packages/extension/src/wallet/services/profile/service.ts#L53)
- if the profile is password-backed, it calls `restorePasswordSession()` in [`profile/service.ts:68`](../../packages/extension/src/wallet/services/profile/service.ts#L68)
- `restorePasswordSession()` rebuilds the AES key from stored `passhash`, decrypts the secret, and reconstructs `activeSession` in [`profile/service.ts:531`](../../packages/extension/src/wallet/services/profile/service.ts#L531)

### Passkey session behavior

Passkey sessions are **not** restored across worker restart:

- `init()` only restores password sessions in [`profile/service.ts:68`](../../packages/extension/src/wallet/services/profile/service.ts#L68)
- there is no equivalent `restorePasskeySession()`

Practical consequence:

- password unlock can survive MV3 worker churn within session TTL
- passkey unlock cannot; the user must re-run WebAuthn

This may be intentional, but it is a real behavior difference.

### Security read on `passhash`

For password profiles, `session.passhash` is base64-encoded `SHA-256(password)` in storage.session. That digest is enough to reconstruct the PBKDF2 base key and therefore decrypt the stored secret.

So during an active password session, the effective bearer credential is not the raw password anymore, but the stored `passhash`.

Risk: medium  
Why: any code that can read extension session storage and invoke the same crypto path can recover the master secret without prompting the user again.

## Migration behavior

The current migration is intentionally destructive.

`runStorageMigration()` in [`packages/extension/src/wallet/storage/migrate.ts:27`](../../packages/extension/src/wallet/storage/migrate.ts#L27):

- checks `nulo:core:storage-version`
- if not current, wipes:
  - `nulo:core:accounts`
  - `nulo:core:txs`
  - `nulo:core:tx-cursors`
  - `nulo:core:token-balances`
  in [`migrate.ts:13`](../../packages/extension/src/wallet/storage/migrate.ts#L13)
- wipes IndexedDB databases named `keyval-store` or prefixed `pxe/` in [`migrate.ts:15`](../../packages/extension/src/wallet/storage/migrate.ts#L15)
- preserves profiles and passkey credentials

This matches the repo-level migration note: old Azguard account addressing was abandoned, and account/tx/balance state is re-derived after unlock.

## What is durable vs ephemeral

### Durable

- profile records
- encrypted password secrets
- passkey credential ids
- networks
- accounts
- contacts
- dApp sessions and capability grants
- tokens and token balances
- tx history
- auth registry tracking
- FPC definitions
- config
- PXE IndexedDB data per `profileId/chainId`

### Ephemeral

- live `activeSession.secret`
- task tree
- pending dApp approvals
- pending passkey requests
- worker-side gas balance cache
- transaction polling `pending` map
- node/PXE client maps

## Architectural debt and risks

### 1. Storage wrappers are stringly and unschematized

No runtime schema validation is applied when reading from Chrome storage. Corrupt or partially migrated values will fail late inside service logic.

Risk: medium  
Size to improve: days

### 2. `SimpleStorage` and per-entity versioning are dead surface area

They add conceptual weight without carrying real migration responsibility.

Risk: low  
Size to improve: hours

### 3. Password sessions persist decrypt-capable material

`session.passhash` is sufficient to reconstruct the encryption base key.

Risk: medium  
Size to improve: days

### 4. Passkey and password session semantics differ

This is probably intentional, but it should be documented explicitly because it affects UX and threat modeling.

Risk: low  
Size to improve: hours

### 5. Most wallet metadata is plaintext at rest

Even privacy-first user expectations may not match the actual storage model if they assume tx history, contacts, connected apps, and token lists are encrypted too.

Risk: medium  
Size to improve: weeks

## Concrete remediations

1. Introduce schema-checked storage repositories.
Wrap each persisted collection with read/write validation and explicit migrations.
Risk: medium  
Size: days

2. Consolidate storage versioning.
Either remove `EntityStorage.getVersion/setVersion()` or make per-collection migrations real.
Risk: low  
Size: hours

3. Revisit password session material.
Prefer storing a re-auth token that cannot directly decrypt the secret, or explicitly document that active password sessions are equivalent to unlocked secret access.
Risk: medium  
Size: days

4. Document and test passkey-vs-password session asymmetry.
This should be an intentional product/security decision, not an emergent side effect.
Risk: low  
Size: hours

5. Consider encrypting more profile-scoped metadata.
Connected dApps, contacts, tx history, and account metadata are the most privacy-sensitive plaintext sets.
Risk: high  
Size: weeks
