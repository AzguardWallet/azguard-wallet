import { LogLevel, LogOrigin } from "@/wallet/services/logger/client/models"
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { PxeService } from "@/wallet/services/pxe";
import { OFFSCREEN_READY_MESSAGE } from "@/wallet/utils/offscreen";

const loggerService = new LoggerServiceClient()
function patchConsoleMethods() {
    for (const level of Object.values(LogLevel)) {
        const cbName = `on${level}`;

        (window as any)[cbName] = (...args: any[]) => {
            const stringArgs = (args ?? []).map(a => {
				if (a === null || a === undefined) return String(a);
				if (typeof a === "object") {
					try {
						return JSON.stringify(a);
					} catch {
						return String(a);
					}
				}
				return String(a);
			});

            loggerService.addLog(
                level,
                stringArgs.join(" "),
                undefined,
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
