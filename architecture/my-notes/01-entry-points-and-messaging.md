# Nulo Wallet Chrome Extension: Entry Points & Inter-Entry-Point Messaging Architecture

**Last Updated:** 2026-04-20  
**Scope:** Manifest V3 extension, 4 entry points, typed RPC-like messaging  
**Status:** Deep exploration completed

---

## Executive Summary

The Nulo wallet is a Manifest V3 Chrome extension implementing Aztec's private execution environment via a distributed architecture:

- **Service Worker (background)** processes all business logic and holds services
- **Popup UI** (Vue 3) communicates via port-based RPC to Service Worker
- **Content Script** relays page-injected provider messages via `chrome.runtime.sendMessage`
- **Offscreen Document** hosts the PXE (Aztec's private execution layer) in a separate context

The extension uses a typed, request-response messaging pattern with automatic client reconnection on disconnect. Critical limitation: Service Workers are idle-killed after ~30s, forcing aggressive keepalive pinging from the offscreen document.

---

## Part 1: Entry Points & Initialization Sequence

### 1.1 Service Worker: `/src/wallet/index.ts`

**Entry Point Type:** Background Service Worker (MV3)  
**Manifest Declaration:** `background.service_worker: "service-worker-loader.js"`

#### Module-Eval Side Effects

The entire initialization happens **synchronously at module load time**, then hands off to async functions:

```typescript
// /src/wallet/index.ts:30-32
const config = new ConfigStore()
const logger = new LoggerStore(config)
const services = new ServiceCollection()

// /src/wallet/index.ts:117-126
initRuntime()
logger
  .rehydrate()
  .catch(() => {})
  .then(() => {
    logger.log("wallet", LogLevel.Info, "Service worker started")
    runServices()
    runHeartbeat()
  })
```

**Timeline:**

1. **sync (line 1):** Import `@/utils/console-sniffer` → hooks `console.*` methods globally
   - Buffers logs until `self.on{method}` callbacks are installed
   - File: `/src/utils/console-sniffer.ts:1-32`

2. **sync (line 2):** Import `BarretenbergSync` from `@aztec/bb.js`
   - Module loads but **does not initialize** (init deferred to `initBarretenberg()`)

3. **sync (lines 30-32):** Create module-level singletons:
   - `ConfigStore` — loads config from chrome.storage (async, but constructor is sync)
   - `LoggerStore` — creates in-memory circular buffer (10k logs in debug, 1k in prod)
   - `ServiceCollection` — service registry

4. **sync (line 117):** `initRuntime()` → registers error handlers:
   - `self.onunhandledrejection` catches promise rejections
   - `self.on{log,info,warn,error}` hijack console methods
   - `chrome.runtime.setUninstallURL("https://nulo.sh/forms/uninstall")`

5. **async (line 119):** `logger.rehydrate()` → restore logs from `chrome.storage.session["nulo:logs"]`

6. **async (line 124):** `runServices()` → **critical init sequence:**
   - Parallel: `initConfig()` + `initBarretenberg()`
     - `initConfig()`: `await config.load()` from `chrome.storage.local`
     - `initBarretenberg()`: `await BarretenbergSync.initSingleton({ wasmPath: ... })`
   - `await runStorageMigration(...)` → database migrations
   - Construct **all 17 services** (none are lazily created)
   - Call `await services.start()` → invokes `service.start(services)` for each in parallel
     - Services then call `init(services)` to cross-reference dependencies
   - Call `initWalletSdkHandler(services, logger)` → wire wallet-sdk protocol

7. **async (line 115):** `runHeartbeat()` → infinite loop, writes to `chrome.storage.session["nulo:liveness"]` every 10s
   - Chrome kills idle SWs after ~30s; this keeps it alive during inactivity

#### Critical Observations

- **No lazy service instantiation.** All 17 services are created eagerly at startup.
- **Module-level singletons:** `config`, `logger`, `services` are created once per SW lifecycle and never recreated.
- **Cross-service dependency injection:** Services retrieve each other via `services.get(ServiceName)` in their `init()` methods.
- **Rehydration:** Logs from the previous SW lifecycle are restored from session storage (crash recovery).
- **Keepalive:** Heartbeat writes every 10s, but offscreen also sends keepalive pings (see 1.4).

---

### 1.2 Popup UI: `/src/popup/index.ts`

**Entry Point Type:** Vue 3 Single-Page App  
**Manifest Declaration:** `action.default_popup: "src/popup/index.html#/popup/general"`

#### Module-Eval Side Effects

Similar error handling + Vue bootstrap:

```typescript
// /src/popup/index.ts:1-16
const logger = new LoggerServiceClient("popup")
for (const [method, level] of consoleMethods) {
  ;(self as any)[`on${method}`] = (...args: any[]) => {
    logger.log("ui", level, ...args)
  }
}
self.onunhandledrejection = (e: PromiseRejectionEvent) => {
  logger.log("ui", LogLevel.Error, getErrorData(e.reason))
}

// /src/popup/index.ts:19-99
import { createPinia } from "pinia"
import { createApp } from "vue"
import { createRouter, createWebHashHistory } from "vue-router/auto"
import App from "./app.vue"
// ... config BigNumber, create router, mount Vue app
createApp(App).use(router).use(createPinia()).mount("#app")
```

**Timeline:**

1. **sync:** Create `LoggerServiceClient("popup")` → async-capable client, but constructor is sync
2. **sync:** Install console hijacking + error handler
3. **sync:** Create Pinia store, Vue Router, create and mount app
   - **No** service clients are created at module load
   - All service clients (`ProfileServiceClient`, `NetworkServiceClient`, etc.) are created **in component `setup()` or in `app.vue`**

#### Entry point from `app.vue` setup:

```typescript
// /src/popup/app.vue:1-20
import { managers, initTransactionService, isBackgroundConnected } from "@/utils/core.js"

const appStore = useAppStore()
const popupStore = usePopupStore()

const configService = new ConfigServiceClient()
configService.onUpdate.add(applySetting)
configService.connect()  // <-- starts listening
```

And also from `/src/utils/core.js`:

```javascript
// /src/utils/core.js:14-27
const profileService = new ProfileServiceClient()
profileService.onConnected.add(onConnected)
profileService.onDisconnected.add(onDisconnected)
profileService.connect()  // <-- auto-connects!

const contactService = new ContactServiceClient()
contactService.connect()  // <-- auto-connects!

export const managers = {
  profile: profileService,
  network: null,  // initialized later in app.vue
  transaction: null,
  contact: contactService,
}
```

**Critical Observations:**

- **Two-phase client creation:**
  1. `/src/utils/core.js` creates singleton clients at module load (when imported)
  2. `app.vue` creates additional clients on-demand in component setup
- **Automatic connection:** Clients call `.connect()` at module load, initiating port establishment
- **State module-level mutation:** `managers` object is a singleton that gets mutated (network/transaction set to null then reassigned)

---

### 1.3 Content Script: `/src/content-script/content.ts`

**Entry Point Type:** Content Script (injected into all frames)  
**Manifest Declaration:** `content_scripts[0]`

#### Module-Eval Side Effects

Extremely minimal—pure relay:

```typescript
// /src/content-script/content.ts:1-22
import { ContentScriptConnectionHandler } from "@aztec/wallet-sdk/extension/handlers"

const handler = new ContentScriptConnectionHandler({
  sendToBackground: (message) => chrome.runtime.sendMessage(message),
  addBackgroundListener: (listener) => {
    chrome.runtime.onMessage.addListener((message: any) => {
      listener(message)
      return undefined
    })
  },
})

handler.start()
```

**Purpose:**

1. Receives discovery/key-exchange/message-relay traffic from in-page provider script
2. Forwards to Service Worker via `chrome.runtime.sendMessage()`
3. Relays responses back to page via postMessage/MessagePort

**No side effects at init time.** The `ContentScriptConnectionHandler` from `@aztec/wallet-sdk` manages all protocol details (ECDH, AES-256-GCM, discovery).

---

### 1.4 Offscreen Document: `/src/offscreen/index.ts`

**Entry Point Type:** Offscreen Document  
**Manifest Declaration:** `permissions: ["offscreen"]`  
**Created by:** Service Worker via `chrome.offscreen.createDocument()`

#### Module-Eval Side Effects

Minimal, but with critical health-check listener:

```typescript
// /src/offscreen/index.ts:8-15
chrome.runtime.onMessage.addListener((message) => {
  if (message === OFFSCREEN_PING) {
    chrome.runtime.sendMessage(OFFSCREEN_PONG).catch(() => {})
  }
  return false
})

const logger = new LoggerServiceClient("offscreen")
// ... console hijacking ...

// /src/offscreen/index.ts:37-43
const services = new ServiceCollection()
services.add(new PxeService())
await services.start()
logger.log("pxe", LogLevel.Info, `Offscreen services initialized (${Date.now() - t0}ms)`)

chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE)
```

**Timeline:**

1. **sync:** Register `OFFSCREEN_PING` listener → immediately responds with `OFFSCREEN_PONG`
   - File: `/src/wallet/utils/offscreen.ts:1-4, 10-15`
   - This is **async-safety:** SW can health-check without waiting

2. **async:** Create and start `PxeService`
   - Connects to ProfileService, ConfigService clients
   - Initializes IndexedDB-backed PXE
   - Spawns known contract artifact registry

3. **async:** Send `OFFSCREEN_READY_MESSAGE` to SW
   - SW waits for this message before marking offscreen as ready
   - If not received within 10s, offscreen is killed and recreated

#### Offscreen Lifecycle Management

The Service Worker manages offscreen creation/cleanup:

```typescript
// /src/wallet/utils/offscreen.ts:101-134
export async function ensureOffscreenRunning() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  })

  if (existingContexts.length > 0) {
    if (await isOffscreenHealthy()) {
      return  // Reuse existing, responsive offscreen
    }
    await closeOffscreen()  // Kill zombie, recreate below
  }

  // Create new offscreen, wait for OFFSCREEN_READY_MESSAGE with 10s timeout
  offscreenPromise = new Promise((resolve, reject) => { ... })
  offscreenTimeout = setTimeout(onOffscreenTimeout, READY_TIMEOUT_MS)
  await createOffscreen()
  await offscreenPromise
}
```

**Zombie Offscreen Bug Handling:**

Chrome has a known bug where `getContexts()` returns empty but `createDocument()` throws "single offscreen document already exists". The code handles this:

```typescript
// /src/wallet/utils/offscreen.ts:79-99
async function createOffscreen() {
  try {
    await chrome.offscreen.createDocument({ ... })
  } catch (err) {
    if (String(err).includes("single offscreen document")) {
      await closeOffscreen()
      await chrome.offscreen.createDocument({ ... })  // Retry once
    } else {
      throw err
    }
  }
}
```

---

## Part 2: Inter-Entry-Point Messaging Architecture

### 2.1 Popup ↔ Service Worker: Port-Based RPC

**Pattern:** `chrome.runtime.connect()` + `Port.postMessage()` + `Service` / `ServiceClient`

#### Message Flow: Popup Calls Service

1. **Client Initiates (Popup):**

```typescript
// /src/wallet/base/background/client.ts:29-48
public async connect() {
  if (this.state !== ClientState.Disconnected) return
  this.state = ClientState.Connecting
  while (this.state === ClientState.Connecting) {
    try {
      this.port = chrome.runtime.connect(undefined, { name: this.service })
      this.port.onDisconnect.addListener(this.onDisconnect)
      this.port.onMessage.addListener(this.onMessage)
      this.state = ClientState.Connected
      this.onConnected.invoke()
      return
    } catch (error) {
      await sleep(1000)  // Retry on connection failure
    }
  }
}

// Send request
// /src/wallet/base/background/client.ts:101-134
protected async request<T extends keyof TRequests>(method: T, ...params: Parameters<TRequests[T]>) {
  while (this.state !== ClientState.Connected) {
    if (this.state === ClientState.Disconnected) {
      this.connect()
    }
    await sleep(300)
  }
  
  const request: RequestMessage<TRequests> = {
    type: MessageType.Request,
    content: {
      requestId: this.getRequestId(),  // Monotonically increasing ID
      method: method,
      params: jsonSanitize(wrapParams(params)),
    },
  }
  
  const promise = new Promise<ReturnType<TRequests[T]>>((resolve, reject) => {
    this.requests.set(request.content.requestId, [resolve, reject])
  })
  this.port!.postMessage(request)
  
  const warnTimer = setTimeout(() => {
    this.logWarn(`Request pending >10s: ${methodName}`)
  }, 10_000)
  
  return promise.finally(() => {
    clearTimeout(warnTimer)
  })
}
```

2. **Server Receives (Service Worker):**

```typescript
// /src/wallet/base/background/service.ts:24-47
protected constructor(name: string, logger: ILogger) {
  this.name = name
  this.logger = logger
  chrome.runtime.onConnect.addListener(this.onConnect)  // Global listener, per-service
}

private readonly onConnect = (client: chrome.runtime.Port) => {
  if (client.name !== this.name) return  // Dispatch by service name
  
  client.onDisconnect.addListener(this.onDisconnect)
  client.onMessage.addListener(this.onMessage)
  this.clients.push(client)
}

private readonly onMessage = async (message: RequestMessage<TRequests>, client: chrome.runtime.Port) => {
  if (message?.type !== MessageType.Request || !message.content) {
    this.logWarn("Invalid message received")
    return
  }
  
  const { requestId, method, params: wrappedParams } = message.content
  const params = unwrapParams(wrappedParams)
  
  let response: ResponseMessage<TRequests>
  try {
    const result = await this.requests[method](...params)
    response = {
      type: MessageType.Response,
      content: {
        requestId,  // Echo requestId for correlation
        result: jsonSanitize(result),
      },
    }
  } catch (error) {
    response = {
      type: MessageType.Response,
      content: {
        requestId,
        error: getErrorMessage(error),
      },
    }
  }
  
  this.send(response, client)  // Send back via port
}
```

3. **Client Receives Response:**

```typescript
// /src/wallet/base/background/client.ts:72-99
private readonly onMessage = (message: ResponseMessage<TRequests> | EventMessage<TEvents>) => {
  if (message.type === MessageType.Response) {
    const { requestId, result, error } = message.content
    const requestPromise = this.requests.get(requestId)
    
    if (!requestPromise) {
      this.logWarn("Invalid response received")
      return
    }
    
    const [resolve, reject] = requestPromise
    if (error !== undefined) {
      reject(error)
    } else {
      resolve(result)
    }
    
    this.requests.delete(requestId)  // Clean up promise
  } else if (message.type === MessageType.Event) {
    // Handle event broadcast
    ;(this as EventsSpec<TEvents>)[event].invoke(payload)
  }
}
```

#### Request Correlation

- **ID Generation:** `nextRequestId++` (line 137 in client.ts), monotonic per client
- **Storage:** `Map<requestId, [resolve, reject]>` (line 19 in client.ts)
- **Correlation:** Response echoes `requestId`; client looks up promise and resolves it
- **Timeout:** No built-in timeout at message level; caller-side timeouts via promise wrapping
- **Order:** Not guaranteed; responses are correlated by ID, not order

#### Port Lifecycle

**Connection Flow:**

```
Popup calls service.request()
  → if disconnected, call connect()
  → chrome.runtime.connect({ name: "service-name" })
  → SW receives onConnect, matches by name
  → Both register onMessage, onDisconnect listeners
  → Ready to send/receive
```

**Disconnection Flow:**

```
Port breaks (SW dies, network error, etc.)
  → Client's onDisconnect fires
  → Client state → Disconnecting → Disconnected
  → Pending requests rejected with "Client disconnected"
  → Client auto-reconnects on next request() call
```

**Event Broadcasting:**

```typescript
// /src/wallet/base/background/service.ts:99-112
protected emit<T extends keyof TEvents>(event: T, payload: TEvents[T]) {
  const message: EventMessage<TEvents> = {
    type: MessageType.Event,
    content: {
      event,
      payload: jsonSanitize(payload),
    },
  }
  for (const client of this.clients) {
    this.send(message, client)  // Send to all connected clients
  }
  this.events[event].invoke(payload)  // Also invoke locally
}
```

Events are **sent to all connected clients**, not unicast.

---

### 2.2 Service Worker ↔ Offscreen: Stateless Message Passing

**Pattern:** `chrome.runtime.sendMessage()` + `chrome.runtime.onMessage.addListener()` + explicit `from/to` routing

Fundamentally different from popup↔SW because:
- No persistent port connection
- SW is frequently idle/killed and recreated
- Offscreen must tolerate orphaned requests
- Must support keepalive to keep SW alive during long operations

#### Message Flow: Service Worker Calls Offscreen

1. **Client Initiates (Service Worker via PxeServiceClient):**

```typescript
// /src/wallet/base/offscreen/client.ts:95-126
protected async request<T extends keyof TRequests>(method: T, ...params: Parameters<TRequests[T]>) {
  if (!this.connected) {
    this.connect()  // Register listener
  }
  
  const request: RequestMessage<TRequests> = {
    type: MessageType.Request,
    content: {
      requestId: this.getRequestId(),
      method: method,
      params: jsonSanitize(wrapParams(params)),
    },
    from: this.uid,         // Unique client ID
    to: this.service,       // "pxe"
  }
  
  const requestId = request.content.requestId
  const promise = new Promise<ReturnType<TRequests[T]>>((resolve, reject) => {
    this.requests.set(requestId, [resolve, reject])
    
    const timer = setTimeout(() => {
      if (this.requests.delete(requestId)) {
        this.requestTimers.delete(requestId)
        reject(`Offscreen request timed out: ${methodName}`)
      }
    }, REQUEST_TIMEOUT_MS)  // 90 seconds
    this.requestTimers.set(requestId, timer)
  })
  
  await chrome.runtime.sendMessage(request)
  return promise
}

public connect() {
  if (this.connected) return
  chrome.runtime.onMessage.addListener(this.onMessageListener)
  this.connected = true
}

private readonly onMessageListener = (message: ResponseMessage<TRequests> | EventMessage<TEvents>): boolean => {
  if (message.to === this.uid || (message.type === MessageType.Event && message.from === this.service && message.to === undefined)) {
    this.onMessage(message)  // Process
  }
  return false
}
```

**Note:** Request timeout is **90 seconds** (vs. 10s for popup↔SW), because:
- PXE operations (proof generation) can take 60s+
- Network fetch timeout adds buffer

2. **Server Receives (Offscreen):**

```typescript
// /src/wallet/base/offscreen/service.ts:43-104
private readonly onMessageListener = (message: RequestMessage<TRequests>): boolean => {
  if (message.to === this.name) {  // Only process if directed at this service
    this.onMessage(message)
  }
  return false
}

private readonly onMessage = async (message: RequestMessage<TRequests>) => {
  if (message?.type !== MessageType.Request || !message.from || !message.content) {
    return
  }
  
  const { requestId, method, params: wrappedParams } = message.content
  const params = unwrapParams(wrappedParams)
  
  // Keepalive: Chrome kills idle SWs after 30s. During long operations,
  // periodically send messages to keep it alive.
  const keepalive = setInterval(() => {
    chrome.runtime.sendMessage(OFFSCREEN_KEEPALIVE).catch(() => {})
  }, KEEPALIVE_INTERVAL_MS)  // 20 seconds
  
  let response: ResponseMessage<TRequests>
  try {
    const result = await this.requests[method](...params)
    response = {
      type: MessageType.Response,
      content: {
        requestId,
        result: jsonSanitize(result),
      },
      from: this.name,
      to: message.from,  // Echo sender's UID
    }
  } catch (error) {
    response = {
      type: MessageType.Response,
      content: {
        requestId,
        error: getErrorMessage(error),
      },
      from: this.name,
      to: message.from,
    }
  } finally {
    clearInterval(keepalive)
  }
  
  try {
    await chrome.runtime.sendMessage(response)
  } catch {
    // SW is dead; response is lost. Client's 90s timeout will reject.
  }
}
```

3. **Client Receives Response:**

```typescript
// /src/wallet/base/offscreen/client.ts:50-93
private readonly onMessage = (message: ResponseMessage<TRequests> | EventMessage<TEvents>) => {
  if (message.type === MessageType.Response) {
    const { requestId, result, error } = message.content
    const requestPromise = this.requests.get(requestId)
    
    if (!requestPromise) {
      this.logWarn("Invalid response received")
      return
    }
    
    const [resolve, reject] = requestPromise
    if (error !== undefined) {
      reject(error)
    } else {
      resolve(result)
    }
    
    this.requests.delete(requestId)
    const timer = this.requestTimers.get(requestId)
    if (timer) {
      clearTimeout(timer)
      this.requestTimers.delete(requestId)
    }
  }
}
```

#### Key Differences from Popup↔SW

| Aspect | Popup↔SW | SW↔Offscreen |
|--------|----------|-------------|
| Connection | Persistent `Port` | Stateless `sendMessage()` |
| Addressing | Service name in `Port.name` | Explicit `from/to` UIDs |
| Timeout | 10s (caller can override) | 90s (built-in) |
| Keepalive | Heartbeat writes every 10s | Request-side keepalive pings every 20s |
| Event broadcast | Sent to all connected clients | Sent to SW without `to` (SW broadcasts to all listeners) |
| Reconnect | Auto-reconnect on disconnect | No reconnect; use `connect()` to start listening |

---

### 2.3 Content Script ↔ Page: postMessage + MessagePort

**Pattern:** Page injects provider script via `<script>` tag; communication via `postMessage()` and `MessagePort` (Chrome Extension messaging API isn't available in page context)

**Content Script Role:**

```typescript
// /src/content-script/content.ts:9-22
const handler = new ContentScriptConnectionHandler({
  sendToBackground: (message) => chrome.runtime.sendMessage(message),
  addBackgroundListener: (listener) => {
    chrome.runtime.onMessage.addListener((message: any) => {
      listener(message)
      return undefined
    })
  },
})

handler.start()
```

**Message Flow:**

1. Page calls `window.aztec.connectWallet()` or similar
2. In-page script posts discovery request via `postMessage()` to content script
3. Content script receives via `window.addEventListener("message", ...)`
4. Content script forwards to SW via `chrome.runtime.sendMessage()`
5. SW processes via `WalletSdkDispatcher`, sends response
6. Content script receives response via `chrome.runtime.onMessage`
7. Content script forwards back to page via `postMessage()`

**Key Detail:** The `ContentScriptConnectionHandler` from `@aztec/wallet-sdk` encapsulates this relay. The extension code doesn't manually wire message forwarding; it's delegated to the wallet-sdk library.

---

### 2.4 Message Schema & Serialization

#### Base Message Types

```typescript
// /src/wallet/base/messages.ts
export enum MessageType {
  Event = 1,
  Request = 2,
  Response = 3,
}

export type EventMessage<T extends EventsMap> = {
  type: MessageType.Event
  content: {
    event: E extends keyof T ? E : never
    payload: T[E]
  }
}

export type RequestMessage<T extends MethodsMap> = {
  type: MessageType.Request
  content: {
    requestId: number
    method: M extends keyof T ? M : never
    params: Parameters<T[M]>
  }
}

export type ResponseMessage<T extends MethodsMap> = {
  type: MessageType.Response
  content: {
    requestId: number
    result?: ReturnType<T[M]>
    error?: string
  }
}
```

#### Offscreen Extension (for routing)

```typescript
// /src/wallet/base/offscreen/messages.ts
type MessageExt = {
  from: string
  to?: string
}

export type EventMessage<T extends EventsMap> = BaseEventMessage<T> & MessageExt
export type RequestMessage<T extends MethodsMap> = BaseRequestMessage<T> & MessageExt
export type ResponseMessage<T extends MethodsMap> = BaseResponseMessage<T> & MessageExt
```

#### Serialization

- **JSON-safe:** `jsonSanitize()` removes non-serializable values (functions, circular refs)
- **Param wrapping:** `wrapParams()` converts `...params` to array; `unwrapParams()` unwraps
- **Schema validation:** Some responses are validated via Zod (e.g., PXE responses)

---

## Part 3: Service Lifecycle & State Management

### 3.1 Service Initialization Order

In `/src/wallet/index.ts:74-104`:

```typescript
const runServices = async () => {
  await Promise.all([initConfig(), initBarretenberg()])  // Parallel

  await runStorageMigration(...)

  // Construct all services (sync)
  services.add(new AccountService(logger))
  services.add(new AccountStateService(logger))
  // ... 15 more services
  services.add(new PasskeyService(logger))

  // Initialize all services (async, parallel)
  await services.start()

  // Wallet-SDK protocol setup (must be after services.start)
  initWalletSdkHandler(services, logger)
}
```

Each service's `init(services)` method:
- Called during `services.start()` (in parallel)
- Retrieves dependencies via `services.get(OtherService.name)`
- Wires up event listeners, storage initialization, etc.

**Dependency Graph Example:**

```
ExecutionService.init()
  → services.get(NetworkService)
  → services.get(AccountService)
  → services.get(PxeServiceClient)  // Creates client, registers listener
  → services.get(DappInteractionService)
  → services.get(ProfileService)
  → ...
```

### 3.2 Shared Global State & Mutable Singletons

#### Service Worker Globals

```typescript
// /src/wallet/index.ts:30-32 — **LIVE FOR ENTIRE SW LIFECYCLE**
const config = new ConfigStore()
const logger = new LoggerStore(config)
const services = new ServiceCollection()
```

These are created once when the SW starts and persist across all client connections, until the SW is idle-killed and recreated.

#### Popup Globals

```javascript
// /src/utils/core.js:6, 14-27 — **LIVE FOR POPUP LIFETIME**
export const isBackgroundConnected = ref(false)

const profileService = new ProfileServiceClient()
const contactService = new ContactServiceClient()

export const managers = {
  profile: profileService,
  network: null,           // <-- MUTABLE
  transaction: null,       // <-- MUTABLE
  contact: contactService,
}
```

**Problem:** `managers` is a singleton object mutated in place:

```typescript
// /src/popup/app.vue:79-82
managers.network?.disconnect()
managers.network = new NetworkServiceClient()  // <-- Replace the client
// ...
managers.account = new AccountServiceClient()  // <-- Same pattern
```

This is fine for a single popup instance, but creates issues if:
- Multiple popups are open simultaneously (unlikely in practice)
- Tests create multiple app instances

#### Pinia Stores

Pinia creates a singleton store per store definition, persisted for the popup's lifetime:

```typescript
// /src/stores/app.store.ts:42-150
export const useAppStore = defineStore("app", () => {
  const profile = ref()
  const accounts = ref<Account[]>([])
  const network = ref()
  // ... 20 more refs
})
```

Each ref is reactive and triggers UI updates on mutation.

### 3.3 Module-Level Side Effects: Footguns

#### In `/src/utils/core.js`

```javascript
const profileService = new ProfileServiceClient()
profileService.onConnected.add(onConnected)
profileService.onDisconnected.add(onDisconnected)
profileService.connect()  // <-- Starts async connection to SW
```

This runs **at module import time** (when `app.vue` or a component imports `managers`). If the SW is not yet ready, the client will retry for up to ~30s, blocking component setup.

#### In `/src/popup/index.ts`

```typescript
const logger = new LoggerServiceClient("popup")
for (const [method, level] of consoleMethods) {
  ;(self as any)[`on${method}`] = (...args: any[]) => {
    logger.log("ui", level, ...args)  // <-- Calls SW immediately
  }
}
```

Any early console call (before SW is ready) may fail silently if the client isn't connected.

#### Risk for Unit Tests

- Importing `app.vue` automatically creates service clients and tries to connect to a (non-existent) SW
- Importing `/src/utils/core.js` automatically creates clients and tries to connect
- Must mock `chrome` API and manually control client lifecycle in tests

---

## Part 4: Service Worker Lifecycle Under MV3

### 4.1 Idle Timeout & Keepalive

**Chrome MV3 Behavior:**
- Service Workers are killed after ~30 seconds of inactivity
- Any message from any origin resets the inactivity timer

**Nulo's Keepalive Strategy:**

```typescript
// /src/wallet/index.ts:106-115
const runHeartbeat = async () => {
  while (true) {
    try {
      await chrome.storage.session.set({ "nulo:liveness": Date.now() })
    } catch (error) {
      logger.log("wallet", LogLevel.Error, "Heartbeat failed", ...)
    }
    await sleep(10_000)  // Every 10 seconds
  }
}
```

This keeps the SW alive when idle (e.g., user not interacting with popup). Additionally, **offscreen keeps it alive during long operations:**

```typescript
// /src/wallet/base/offscreen/service.ts:63-67
const keepalive = setInterval(() => {
  chrome.runtime.sendMessage(OFFSCREEN_KEEPALIVE).catch(() => {})
}, KEEPALIVE_INTERVAL_MS)  // Every 20 seconds
```

**Timing:**
- Heartbeat: 10s interval
- Long PXE operations: +20s keepalive from offscreen
- Chrome timeout: ~30s
- **Net:** SW should stay alive indefinitely if either heartbeat or offscreen is active

### 4.2 When Popup Closes

1. Port disconnects (or may stay alive for a few seconds due to Chrome buffering)
2. Service keeps the client list; old port becomes a dead reference
3. On next popup open, a new port is created and old reference is discarded (old client's promise will reject on next message)
4. UI state (Pinia stores) is lost; Vue app remounts and re-queries SW

**Potential Issue:** If popup rapidly opens/closes, multiple ports could be created and never cleaned up. The service should gracefully handle stale ports, which it does via the `onDisconnect` callback.

### 4.3 When Service Worker Crashes / Restarts

**Detection:** Popup's `onDisconnected` fires, triggering reconnect attempt:

```typescript
// /src/wallet/base/background/client.ts:67-70
private readonly onDisconnect = () => {
  this.disconnect()
  this.connect()  // <-- Auto-reconnect
}
```

**State Recovery:**
- **Logs:** Rehydrated from `chrome.storage.session["nulo:logs"]` (see `/src/wallet/index.ts:119`)
- **Profile/accounts:** Persisted in `chrome.storage.local`, reloaded on popup re-query
- **Active session:** Stored in `chrome.storage.session["nulo:core:session"]`, restored if valid (TTL-checked)

**PXE Persistence:**
- PXE state (notes, contracts, accounts) is stored in IndexedDB under keys like `pxe/{profile_id}/{network_id}`
- Survives SW restart
- Orphan DBs are cleaned up when profiles are deleted (see `/src/wallet/services/pxe/service.ts:84-116`)

---

## Part 5: Hidden Couplings & Architectural Issues

### 5.1 Module-Level Singletons & Cross-Service Coupling

**Risk:** Services are tightly coupled via shared singletons.

**Example:**

```typescript
// /src/wallet/services/execution/service.ts (constructor)
public constructor(logger: ILogger) {
  super(EXECUTION_SERVICE_NAME, logger)
}

// /src/wallet/services/execution/service.ts (init)
protected async init(services: ServiceCollection) {
  this.pxeService = new PxeServiceClient(this.logger)
  this.accountService = services.get(AccountService)
  this.networkService = services.get(NetworkService)
  // ... 10+ dependencies
}
```

If any dependency is not registered or fails to initialize, `init()` will throw, and all services in parallel will fail (since `services.start()` awaits all in parallel).

**Mitigation:** There's an `ensureInitialized()` helper that waits up to 30s for initialization, but it's not universally used.

### 5.2 Popup → Core.js → Service Clients: Hidden Eager Startup

The `.js` file instead of `.ts`:

```javascript
// /src/utils/core.js — **This is vanilla JS, not TS**
const profileService = new ProfileServiceClient()
profileService.connect()  // <-- AUTO-CONNECTS IMMEDIATELY
```

Any code that imports from this file will trigger a SW connection attempt. This is fine in production (SW is typically ready), but in tests it causes hangs unless mocked.

**Better:** Lazy initialization or explicit `initializeManagers()` function.

### 5.3 Managers Mutation & Reference Instability

```javascript
export const managers = {
  profile: profileService,
  network: null,           // <-- Mutable!
  transaction: null,
  contact: contactService,
}
```

Code that holds a reference to `managers.network`:

```typescript
// In setup()
const networkClient = managers.network
// ... later ...
networkClient.getNetwork()  // <-- Could be null or a different instance
```

This is mitigated by always accessing via `managers.network` (not storing references), but it's fragile.

### 5.4 Console Interception Timing

Two separate console hijack implementations:

1. **Popup** (`/src/popup/index.ts:6-16`):
   ```typescript
   const logger = new LoggerServiceClient("popup")
   for (const [method, level] of consoleMethods) {
     ;(self as any)[`on${method}`] = (...args: any[]) => {
       logger.log("ui", level, ...args)
     }
   }
   ```

2. **Service Worker** (`/src/wallet/index.ts:36-41`):
   ```typescript
   for (const [method, level] of consoleMethods) {
     ;(self as any)[`on${method}`] = (...args: unknown[]) => {
       logger.log("wallet", level, ...args)
     }
   }
   ```

Both hijack `self.onlog`, `self.oninfo`, etc. If executed in the wrong order, one may overwrite the other. However, in practice:
- Service Worker sets these at startup
- Popup sets them at Vue app mount
- They never conflict (different execution contexts)

### 5.5 PxeService Clients Created Per Request

```typescript
// /src/utils/core.js:29-51
export async function refreshBalances(_minutes, accounts) {
  const tokenBalanceService = new TokenBalanceServiceClient()
  const tokenBalances = []
  for (const acc of accounts) {
    tokenBalances.push(...(await tokenBalanceService.getTokenBalances(...)))
  }
  tokenBalanceService.disconnect()
}
```

A new client is created for each batch refresh. This is intentional (fire-and-forget), but could be pooled for efficiency.

---

## Part 6: Response Correlation Mechanism

### 6.1 Popup↔SW: Port + Monotonic ID

1. **Client (Popup) generates ID:**
   ```typescript
   // /src/wallet/base/background/client.ts:136-138
   private getRequestId() {
     return this.nextRequestId++
   }
   ```
   - Starts at 1
   - Increments per request
   - **Per-client namespace** (each popup instance has its own sequence)

2. **Server (SW) receives ID, echoes it:**
   ```typescript
   // /src/wallet/base/background/service.ts:78-82
   response = {
     type: MessageType.Response,
     content: {
       requestId,  // <-- Echo from request
       result: jsonSanitize(result),
     },
   }
   ```

3. **Client matches response:**
   ```typescript
   // /src/wallet/base/background/client.ts:78-92
   const { requestId, result, error } = message.content
   const requestPromise = this.requests.get(requestId)
   if (!requestPromise) {
     this.logWarn("Invalid response received")
     return
   }
   const [resolve, reject] = requestPromise
   ```

**Assumptions:**
- Each client maintains a `Map<requestId, [resolve, reject]>`
- IDs are unique per client
- If a response arrives out-of-order or for a different client, it will be ignored (or warned about)
- No guarantees about response order

### 6.2 SW↔Offscreen: Explicit Routing + ID

1. **Client (SW) generates ID + explicit routing:**
   ```typescript
   // /src/wallet/base/offscreen/client.ts:99-109
   const request: RequestMessage<TRequests> = {
     type: MessageType.Request,
     content: {
       requestId: this.getRequestId(),
       method: method,
       params: ...,
     },
     from: this.uid,      // <-- Unique client ID (generated once)
     to: this.service,    // <-- "pxe"
   }
   ```

2. **Server (Offscreen) echoes both IDs:**
   ```typescript
   // /src/wallet/base/offscreen/service.ts:74-81
   response = {
     type: MessageType.Response,
     content: {
       requestId,          // <-- Echo request ID
       result: ...,
     },
     from: this.name,      // <-- "pxe"
     to: message.from,     // <-- Echo client's UID
   }
   ```

3. **Client filters by UID:**
   ```typescript
   // /src/wallet/base/offscreen/client.ts:50-51
   private readonly onMessageListener = (message: ResponseMessage<TRequests> | EventMessage<TEvents>): boolean => {
     if (message.to === this.uid || (message.type === MessageType.Event && message.from === this.service && message.to === undefined)) {
       this.onMessage(message)
     }
     return false
   }
   ```

**Why explicit routing?**
- Multiple clients can call offscreen simultaneously
- `chrome.runtime.onMessage` is a global listener; all clients see all messages
- Must filter to client's own responses + broadcast events

---

## Part 7: Content Script to Page Provider

### 7.1 Discovery Flow

1. **Page script broadcasts discovery:**
   ```javascript
   // In-page injected provider
   window.postMessage({
     type: "aztec_wallet_discovery",
     // ...
   }, "*")
   ```

2. **Content script listens (via wallet-sdk handler):**
   - ContentScriptConnectionHandler has a discovery listener
   - Relays to SW via `chrome.runtime.sendMessage(discovery_request)`

3. **SW processes discovery:**
   - Routes to `DappInteractionService.discover()`
   - May show user approval popup

4. **Response relayed back:**
   - SW sends response to content script
   - Content script forwards to page via `postMessage()`

### 7.2 Encrypted Channel

After discovery approval, wallet-sdk establishes:
- **ECDH key exchange** (P-256 curve)
- **AES-256-GCM encrypted channel** for subsequent messages
- Content script becomes a relay; actual crypto happens in page and SW

---

## Part 8: Known Limitations & Uncertainties

### 8.1 Popup Timing Issues

**Uncertainty:** If popup opens immediately after extension install, what's the initialization order?

- Extension install might not trigger heartbeat immediately
- SW might not have spawned all services yet
- Popup's `managers.profile.connect()` might timeout

**Mitigation:** App.vue has a router guard that checks `appStore.isSessionChecked` before proceeding. If not set, it waits for profile state.

### 8.2 Multiple Popups

**Not tested:** What happens if user opens the extension popup multiple times?

- Each popup creates its own Vue app + Pinia store
- Each creates its own service clients
- All clients connect to the same SW via separate ports
- SW maintains a list of all connected clients

**Likely OK**, but potential for state inconsistency (e.g., one popup changes the profile, the other doesn't refresh in time).

### 8.3 Offscreen Zombie Recovery

**Uncertainty:** The "ghost offscreen" bug handling assumes `isOffscreenHealthy()` can detect a zombie. What if the ping succeeds but the offscreen is not actually processing requests?

```typescript
// /src/wallet/utils/offscreen.ts:38-62
async function isOffscreenHealthy(): Promise<boolean> {
  // Sends OFFSCREEN_PING, waits 3s for OFFSCREEN_PONG
  // If no response, assumes dead
}
```

If offscreen is stuck (e.g., in an infinite loop), the ping might still succeed, and a bad state persists.

### 8.4 Request Timeouts

- **Popup→SW:** 10s warn timeout, no hard limit
- **SW→Offscreen:** 90s hard timeout
- **Heartbeat:** 10s interval, no timeout (infinite loop)

If heartbeat fails, SW will die after 30s. No retry or alerting.

---

## Part 9: Recommended Practices for Unit Testing

### 9.1 Mock Structure

```typescript
// Mock chrome API
global.chrome = {
  runtime: {
    connect: jest.fn(() => ({
      postMessage: jest.fn(),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() },
      onDisconnect: { addListener: jest.fn(), removeListener: jest.fn() },
    })),
    onConnect: { addListener: jest.fn() },
    sendMessage: jest.fn(async () => {}),
    onMessage: { addListener: jest.fn() },
  },
  storage: {
    local: { get: jest.fn(), set: jest.fn() },
    session: { get: jest.fn(), set: jest.fn() },
  },
  offscreen: {
    createDocument: jest.fn(),
    closeDocument: jest.fn(),
  },
  // ... other APIs
}
```

### 9.2 Service Client Testing

```typescript
// Don't import managers directly; inject clients
class MyComponent {
  constructor(private profileService: ProfileServiceClient) {}
}

// In test
const mockProfileService = new MockProfileServiceClient()
const component = new MyComponent(mockProfileService)
```

### 9.3 Service Testing

```typescript
// Create isolated services without full startup
const logger = new MockLogger()
const profileService = new ProfileService(mockConfig, logger)
const services = new ServiceCollection()
services.add(profileService)
await services.start()

// Now test profileService methods directly
const profile = await profileService.createProfile("test", "password")
```

---

## Summary Table: Communication Patterns

| Entry Points | Transport | Connection | Timeout | Keepalive | Routing | Correlation |
|---|---|---|---|---|---|---|
| Popup ↔ SW | Port (chrome.runtime.connect) | Persistent | 10s warn | Heartbeat (10s) | Service name | Monotonic ID |
| SW ↔ Offscreen | sendMessage | Stateless | 90s hard | Request keepalive (20s) | from/to UID | Monotonic ID |
| Content Script ↔ Page | postMessage + MessagePort | Stateless | SDK-defined | N/A | Discovery → encrypted channel | Wallet-SDK protocol |

---

## Conclusion

The Nulo wallet uses a **decoupled, message-passing architecture** that leverages Chrome's IPC capabilities to separate concerns:

- Service Worker handles business logic and service orchestration
- Popup provides UI without direct access to sensitive state
- Offscreen isolates PXE computation
- Content script relays untrusted page traffic

**Critical design choices:**
1. **Typed, request-response RPC** for synchronous operations
2. **Event broadcasts** for async state changes
3. **Aggressive keepalive** for SW lifecycle management
4. **Explicit routing** for offscreen stateless messages
5. **Automatic reconnection** to tolerate transient disconnects

**Test-hostile patterns:**
- Module-level eager service instantiation in core.js
- Global mutable `managers` object
- Automatic port connection at client instantiation

**Potential improvements:**
- Lazy client initialization
- Immutable managers interface
- Unified timeout handling (currently per-path)
- Better offscreen zombie detection

---

**Document prepared by:** Code exploration agent  
**Source files analyzed:** 25+ TypeScript files across all entry points  
**Lines of code reviewed:** 3000+
