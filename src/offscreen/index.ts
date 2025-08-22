import { LogLevel, LogOrigin } from "@/wallet/services/logger/client/models"
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { PxeService } from "@/wallet/services/pxe";
import { OFFSCREEN_READY_MESSAGE } from "@/wallet/utils/offscreen";

const loggerService = new LoggerServiceClient()
function patchConsoleMethods() {
    for (const level of Object.values(LogLevel)) {
        const cbName = `on${level}`;

        (window as any)[cbName] = (...args: any[]) => {
            loggerService.addLog(
                level,
                args,
                "pxe",
                LogOrigin.OF
            );
        };
    }
}
patchConsoleMethods()

const pxeService = new PxeService();
pxeService.start();

chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE);

self.onerror = (message, source, lineno, colno, error) => {
    const args: any[] = []
    if (message !== undefined) args.push(message)
    if (source !== undefined) args.push(source)
    if (lineno !== undefined) args.push(`Line: ${lineno}`)
    if (colno !== undefined) args.push(`Column: ${colno}`)
    if (error !== undefined) args.push(error?.stack || String(error))

    loggerService.addLog(
        LogLevel.Error,
        args,
        "pxe",
        LogOrigin.OF
    )

    return false
}

self.onunhandledrejection = (event: PromiseRejectionEvent) => {
    const args: string[] = []

    args.push("Unhandled Promise rejection:");
    if (event.reason !== undefined) {
        if (event.reason instanceof Error) {
            args.push(event.reason.stack || String(event.reason))
        } else {
            args.push(String(event.reason))
        }
    }

    loggerService.addLog(
        LogLevel.Error,
        args,
        "pxe",
        LogOrigin.OF
    )
}
