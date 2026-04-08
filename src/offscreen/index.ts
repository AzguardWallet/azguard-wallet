import { ServiceCollection } from "@/wallet/base"
import { consoleMethods, LogLevel } from "@/wallet/logger"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { PxeService } from "@/wallet/services/pxe/service"
import { getErrorData } from "@/wallet/utils/errors"
import { OFFSCREEN_READY_MESSAGE, OFFSCREEN_PING, OFFSCREEN_PONG } from "@/wallet/utils/offscreen"

// Respond to health check pings from the service worker.
// Registered before anything else so even a slow init doesn't block pong.
chrome.runtime.onMessage.addListener((message) => {
	if (message === OFFSCREEN_PING) {
		chrome.runtime.sendMessage(OFFSCREEN_PONG).catch(() => {})
	}
	return false
})

// catch console
const logger = new LoggerServiceClient("offscreen")
for (const [method, level] of consoleMethods) {
	;(self as any)[`on${method}`] = (...args: any[]) => {
		logger.log("pxe", level, ...args)
	}
}

// catch unhandled errors
self.onunhandledrejection = (e: PromiseRejectionEvent) => {
	try {
		logger.log("pxe", LogLevel.Error, getErrorData(e.reason))
	} catch {
		// Logger itself may fail if SW is dead — don't cascade
	}
}

// run services — await initialization before signaling ready
const t0 = Date.now()
const services = new ServiceCollection()
services.add(new PxeService())
await services.start()
logger.log("pxe", LogLevel.Info, `Offscreen services initialized (${Date.now() - t0}ms)`)

// notify bg only after services are actually initialized
chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE)

export {}
