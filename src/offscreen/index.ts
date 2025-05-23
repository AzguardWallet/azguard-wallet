import { ConsoleSnifferService } from "@/wallet/services/console-sniffer";
import { PxeService } from "@/wallet/services/pxe";
import { OFFSCREEN_READY_MESSAGE } from "@/wallet/utils/offscreen";

const consoleSnifferService = new ConsoleSnifferService("offscreen");
const pxeService = new PxeService();
pxeService.start();

chrome.runtime.sendMessage(OFFSCREEN_READY_MESSAGE);
