import { ConsoleSnifferService } from "@/wallet/services/console-sniffer";
import { LogOrigin } from "@/wallet/services/logger/client/models"
import { PxeService } from "@/wallet/services/pxe";
import { OFFSCREEN_READY_MESSAGE } from "@/wallet/utils/offscreen";

const consoleSnifferService = new ConsoleSnifferService(LogOrigin.OF, "pxe");
const pxeService = new PxeService();
pxeService.start();

chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE);
