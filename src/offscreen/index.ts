import { ServiceCollection } from "@/wallet/base";
import { consoleMethods, LogLevel } from "@/wallet/logger";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { PxeService } from "@/wallet/services/pxe/service";
import { getErrorData } from "@/wallet/utils/errors";
import { OFFSCREEN_READY_MESSAGE } from "@/wallet/utils/offscreen";

// catch console
const logger = new LoggerServiceClient();
for (const [method, level] of consoleMethods) {
    (self as any)[`on${method}`] = (...args: any[]) => {
        logger.log("pxe", level, ...args);
    };
}

// catch unhandled errors
self.onunhandledrejection = (e: PromiseRejectionEvent) => {
    logger.log("pxe", LogLevel.Error, getErrorData(e.reason));
};

// run services
const services = new ServiceCollection();
services.add(new PxeService());
services.start();

// notify bg
chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE);

export {};
