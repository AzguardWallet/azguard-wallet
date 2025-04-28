export const OFFSCREEN_READY_MESSAGE = "OFFSCREEN_READY";

let offscreenTimeout: NodeJS.Timeout;
let offscreenPromise: Promise<void> | null = null;
let resolveOffscreenPromise: () => void;
let rejectOffscreenPromise: (reason: string) => void;

const path = "src/offscreen/index.html";
const offscreenUrl = chrome.runtime.getURL(path);
const onOffscreenReady = (message: any) => {
    if (message === OFFSCREEN_READY_MESSAGE) {
        console.debug("Offscreen ready");
        chrome.runtime.onMessage.removeListener(onOffscreenReady);
        clearTimeout(offscreenTimeout);
        resolveOffscreenPromise();
        offscreenPromise = null;
    }
    return false;
}
const onOffscreenTimeout = () => {
    console.debug("Offscreen timeout");
    chrome.runtime.onMessage.removeListener(onOffscreenReady);
    rejectOffscreenPromise("Offscreen is not responding");
    offscreenPromise = null;
}

export async function ensureOffscreenRunning() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
        return;
    }

    if (!offscreenPromise) {
        offscreenPromise = new Promise((resolve, reject) => {
            resolveOffscreenPromise = resolve;
            rejectOffscreenPromise = reject;
        });
        console.debug("Creating offscreen...");
        offscreenTimeout = setTimeout(onOffscreenTimeout, 5000);
        chrome.runtime.onMessage.addListener(onOffscreenReady);
        chrome.offscreen.createDocument({
            url: path,
            reasons: ["WORKERS"],
            justification: "Offscreen document is used for running PXE in it",
        });
    }

    await offscreenPromise;
}
