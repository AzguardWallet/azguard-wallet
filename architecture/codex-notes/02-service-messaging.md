# 02 Service Messaging

## Scope

This note covers the local RPC/event pattern used across the extension:

- popup / side panel / approval window ↔ service worker
- service worker ↔ offscreen PXE

It is based on the generic transport primitives under `src/wallet/base/` and the PXE client layer that sits on top of the offscreen transport.

## Architectural shape

There are **two different transports** under one conceptual “service client” pattern.

### 1. UI ↔ service worker

- Transport: `chrome.runtime.connect()` long-lived `Port`
- Base classes:
  - [`packages/extension/src/wallet/base/background/client.ts`](../../packages/extension/src/wallet/base/background/client.ts#L1)
  - [`packages/extension/src/wallet/base/background/service.ts`](../../packages/extension/src/wallet/base/background/service.ts#L1)
- Addressing: `Port.name === serviceName`

### 2. service worker ↔ offscreen

- Transport: `chrome.runtime.sendMessage()`
- Base classes:
  - [`packages/extension/src/wallet/base/offscreen/client.ts`](../../packages/extension/src/wallet/base/offscreen/client.ts#L1)
  - [`packages/extension/src/wallet/base/offscreen/service.ts`](../../packages/extension/src/wallet/base/offscreen/service.ts#L1)
- Addressing: explicit `from` / `to` envelope fields in [`packages/extension/src/wallet/base/offscreen/messages.ts:8`](../../packages/extension/src/wallet/base/offscreen/messages.ts#L8)

The type façade is shared (`MethodsMap`, `EventsMap`, `ServiceSpec` in [`packages/extension/src/wallet/base/index.ts:3`](../../packages/extension/src/wallet/base/index.ts#L3)), but the runtime behavior is not.

## Wire format

Both transports use the same base message kinds from [`packages/extension/src/wallet/base/messages.ts:3`](../../packages/extension/src/wallet/base/messages.ts#L3):

- `Event`
- `Request`
- `Response`

Base payload shapes:

- requests carry `requestId`, `method`, `params` in [`messages.ts:25`](../../packages/extension/src/wallet/base/messages.ts#L25)
- responses carry `requestId`, `result?`, `error?` in [`messages.ts:38`](../../packages/extension/src/wallet/base/messages.ts#L38)
- events carry `event`, `payload` in [`messages.ts:13`](../../packages/extension/src/wallet/base/messages.ts#L13)

### Parameter encoding

Arguments are not sent as raw arrays. They are wrapped into an object with numeric keys via [`packages/extension/src/wallet/base/utils.ts:3`](../../packages/extension/src/wallet/base/utils.ts#L3) and restored with [`base/utils.ts:10`](../../packages/extension/src/wallet/base/utils.ts#L10).

This matters because every request/response/event is normalized through `jsonSanitize()` in [`packages/extension/src/wallet/utils/serialization.ts:20`](../../packages/extension/src/wallet/utils/serialization.ts#L20), which performs a JSON stringify/parse round-trip. Wrapping positional params into an object preserves sparse/`undefined` argument positions better than sending raw arrays.

### Serialization semantics

The transport is effectively “JSON-RPC-like”, not structured-clone-preserving:

- `bigint` becomes string in [`serialization.ts:4`](../../packages/extension/src/wallet/utils/serialization.ts#L4)
- `Buffer` becomes base64 in [`serialization.ts:6`](../../packages/extension/src/wallet/utils/serialization.ts#L6)
- `Map` and `Set` are flattened to arrays in [`serialization.ts:10`](../../packages/extension/src/wallet/utils/serialization.ts#L10)
- prototypes are lost entirely because everything is parsed back from JSON in [`serialization.ts:21`](../../packages/extension/src/wallet/utils/serialization.ts#L21)

That last point is important: the type system says these methods return rich domain objects, but the transport only guarantees plain data unless the client manually rehydrates.

## Popup / side panel / approval window ↔ service worker

### Request flow

The client:

- lazily opens a named `Port` with `chrome.runtime.connect(..., { name: this.service })` in [`background/client.ts:36`](../../packages/extension/src/wallet/base/background/client.ts#L36)
- sends a `Request` message in [`background/client.ts:109`](../../packages/extension/src/wallet/base/background/client.ts#L109)
- tracks a promise resolver by `requestId` in [`background/client.ts:117`](../../packages/extension/src/wallet/base/background/client.ts#L117)

The service:

- listens globally on `chrome.runtime.onConnect` in its constructor in [`background/service.ts:24`](../../packages/extension/src/wallet/base/background/service.ts#L24)
- accepts only ports whose `name` matches `this.name` in [`background/service.ts:39`](../../packages/extension/src/wallet/base/background/service.ts#L39)
- validates and unwraps the request in [`background/service.ts:61`](../../packages/extension/src/wallet/base/background/service.ts#L61)
- invokes the method dynamically with `this.requests[method](...params)` in [`background/service.ts:75`](../../packages/extension/src/wallet/base/background/service.ts#L75)
- posts a response back on the same port in [`background/service.ts:95`](../../packages/extension/src/wallet/base/background/service.ts#L95)

### Event flow

Services broadcast events to every connected client port in [`background/service.ts:99`](../../packages/extension/src/wallet/base/background/service.ts#L99). On the client side, incoming events are dispatched into `EventHandler` instances in [`background/client.ts:95`](../../packages/extension/src/wallet/base/background/client.ts#L95).

This is live pub/sub only. There is no event replay, durable cursor, or snapshot handshake beyond whatever ad hoc “get*” methods each service separately exposes.

### Lifecycle behavior

- Clients auto-reconnect on `Port` disconnect in [`background/client.ts:67`](../../packages/extension/src/wallet/base/background/client.ts#L67).
- Any in-flight request is rejected as `"Client disconnected"` during disconnect in [`background/client.ts:58`](../../packages/extension/src/wallet/base/background/client.ts#L58).
- There is no hard timeout for worker-bound requests. The only guard is a warning log after 10s in [`background/client.ts:126`](../../packages/extension/src/wallet/base/background/client.ts#L126).

That is fine for quick storage reads, but it means a wedged background call can remain pending indefinitely unless the port itself drops.

## Service worker ↔ offscreen PXE

### Request flow

The offscreen client:

- assigns itself a random `uid` in [`packages/extension/src/wallet/base/offscreen/client.ts:24`](../../packages/extension/src/wallet/base/offscreen/client.ts#L24)
- sends `Request` messages addressed with `from: uid` and `to: serviceName` in [`offscreen/client.ts:99`](../../packages/extension/src/wallet/base/offscreen/client.ts#L99)
- waits for a matching response or rejects after 90 seconds in [`offscreen/client.ts:9`](../../packages/extension/src/wallet/base/offscreen/client.ts#L9) and [`offscreen/client.ts:112`](../../packages/extension/src/wallet/base/offscreen/client.ts#L112)

The offscreen service:

- listens on `chrome.runtime.onMessage` in [`packages/extension/src/wallet/base/offscreen/service.ts:28`](../../packages/extension/src/wallet/base/offscreen/service.ts#L28)
- only handles messages whose `to` matches the service name in [`offscreen/service.ts:43`](../../packages/extension/src/wallet/base/offscreen/service.ts#L43)
- executes the method and replies with `from: this.name`, `to: message.from` in [`offscreen/service.ts:73`](../../packages/extension/src/wallet/base/offscreen/service.ts#L73)

### Keepalive behavior

During each offscreen request, the service starts a 20-second interval that sends `OFFSCREEN_KEEPALIVE` messages in [`offscreen/service.ts:63`](../../packages/extension/src/wallet/base/offscreen/service.ts#L63). The intent is documented directly in code: keep the MV3 service worker alive during long PXE work.

This is one of the few places the code explicitly models MV3 suspension behavior.

### Offscreen readiness behavior

The generic offscreen client does **not** start the offscreen document itself. The PXE-specific client does that before every method call:

- `await ensureOffscreenRunning()` appears on every public method of [`packages/extension/src/wallet/services/pxe/client.ts`](../../packages/extension/src/wallet/services/pxe/client.ts#L30)
- readiness uses `getContexts()`, `PING/PONG`, and a `READY` message in [`packages/extension/src/wallet/utils/offscreen.ts:101`](../../packages/extension/src/wallet/utils/offscreen.ts#L101)

That means the “transport” and the “process supervisor” are partly separated:

- base offscreen client = message pipe
- `ensureOffscreenRunning()` = lifecycle manager
- `PxeServiceClient` = composition point that remembers to call both

## Startup and ordering semantics

All services are started concurrently through `Promise.all(...)` in [`packages/extension/src/wallet/base/index.ts:43`](../../packages/extension/src/wallet/base/index.ts#L43). Because of that, many service methods defensively call `ensureInitialized()` before doing real work.

Examples:

- [`packages/extension/src/wallet/services/account/service.ts:35`](../../packages/extension/src/wallet/services/account/service.ts#L35)
- [`packages/extension/src/wallet/services/profile/service.ts:73`](../../packages/extension/src/wallet/services/profile/service.ts#L73)

`ensureInitialized()` just polls for up to 30 seconds in both service bases:

- background: [`packages/extension/src/wallet/base/background/service.ts:124`](../../packages/extension/src/wallet/base/background/service.ts#L124)
- offscreen: [`packages/extension/src/wallet/base/offscreen/service.ts:122`](../../packages/extension/src/wallet/base/offscreen/service.ts#L122)

This is a real signal about the architecture: startup ordering is not explicit, so services protect themselves at call time instead.

## Type safety vs runtime safety

The pattern gives good compile-time ergonomics:

- each service exposes typed methods/events through `spec.ts`
- clients inherit a consistent request API
- callers mostly get strong TS inference

But runtime safety is weaker than the types imply:

1. Method dispatch is string-based (`method in this.requests` in [`background/service.ts:67`](../../packages/extension/src/wallet/base/background/service.ts#L67)).
2. There is no schema validation at the background RPC boundary.
3. JSON sanitization strips class identity and custom prototypes.
4. Errors are flattened to strings through `getErrorMessage()` in [`background/service.ts:85`](../../packages/extension/src/wallet/base/background/service.ts#L85) and [`offscreen/service.ts:83`](../../packages/extension/src/wallet/base/offscreen/service.ts#L83).

The PXE layer compensates by manually rehydrating many results with Zod. For example:

- `getContractInstance()` parses with `ContractInstanceWithAddressSchema` in [`packages/extension/src/wallet/services/pxe/client.ts:45`](../../packages/extension/src/wallet/services/pxe/client.ts#L45)
- `getNotes()` explicitly documents that it returns plain objects cast to `NoteDao[]` rather than real instances in [`pxe/client.ts:111`](../../packages/extension/src/wallet/services/pxe/client.ts#L111)

That compensation exists only where authors remembered to add it.

## Coupling and fragility

### 1. Worker RPC is best-effort, not resumable

If the service worker restarts during a request:

- the UI client disconnects
- pending promises reject
- reconnect happens automatically
- the original operation is not resumed or correlated

For idempotent reads this is acceptable. For mutating multi-step operations it creates retry ambiguity.

Risk: medium  
Size to improve: days

### 2. Events are ephemeral

`emit()` fan-outs only to connected listeners in [`background/service.ts:107`](../../packages/extension/src/wallet/base/background/service.ts#L107). If the popup is closed or reconnecting, the event is lost. Consumers must remember to resync manually.

Risk: medium  
Size to improve: days

### 3. Serialization contracts are implicit

The generic transport has no schema boundary. Services rely on “call the matching client and hope both sides serialize the same way.”

This is manageable inside one package, but it becomes brittle once modules move or external callers appear.

Risk: medium  
Size to improve: days to weeks

### 4. Offscreen lifecycle is bolted on at call sites

`ensureOffscreenRunning()` is invoked in each `PxeServiceClient` method rather than embedded in the generic offscreen client. That is easy to forget if another offscreen service is added later.

Risk: low now, medium later  
Size to improve: hours to days

### 5. Initialization ordering is implicit

The existence of `ensureInitialized()` polling across many services is a symptom that service dependencies are not started in a declared order.

Risk: medium  
Size to improve: days

## Concrete remediations

1. Introduce schema-checked RPC envelopes.
Use `zod` or `valibot` per method/event at the transport boundary, not only in PXE rehydration.
Risk: medium  
Size: days

2. Separate transport errors from domain errors.
Return structured errors with `code`, `message`, and optional `details` instead of flattening everything to a string.
Risk: low  
Size: days

3. Add request deadlines and cancellation for background RPC.
Mirror the offscreen 90s timeout pattern and support explicit abort/cancel for long-running worker calls.
Risk: medium  
Size: days

4. Make service startup ordering explicit.
Replace `Promise.all` startup plus `ensureInitialized()` polling with declared dependencies and deterministic start phases.
Risk: medium  
Size: days

5. Add resumable snapshots for event-driven UI state.
For event-heavy services, pair `subscribe()` with an initial snapshot/version so reconnecting UIs can converge deterministically.
Risk: medium  
Size: days to weeks

6. Move offscreen supervision into the offscreen client base.
If the architecture keeps a single offscreen service, make the invariant automatic instead of repeating `ensureOffscreenRunning()` in every PXE method.
Risk: low  
Size: hours

## Bottom line

The current pattern is a good internal convenience layer, but it is not yet a production-grade application protocol. The biggest gap is the mismatch between strong TypeScript façades and weak runtime guarantees: string dispatch, JSON-only serialization, best-effort events, and reconnect-without-resume semantics.
