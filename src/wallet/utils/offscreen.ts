export const OFFSCREEN_READY_MESSAGE = "OFFSCREEN_READY";

let offscreenTimeout: NodeJS.Timeout;
let offscreenPromise: Promise<void> | null = null;
let resolveOffscreenPromise: () => void;
let rejectOffscreenPromise: (reason: string) => void;

const path = "src/offscreen/index.html";
const offscreenUrl = chrome.runtime.getURL(path);
const onOffscreenReady = (message: any) => {
    if (message === OFFSCREEN_READY_MESSAGE) {
        chrome.runtime.onMessage.removeListener(onOffscreenReady);
        clearTimeout(offscreenTimeout);
        resolveOffscreenPromise();
        offscreenPromise = null;
    }
    return false;
}
const onOffscreenTimeout = () => {
    chrome.runtime.onMessage.removeListener(onOffscreenReady);
    rejectOffscreenPromise("Offscreen is not responding");
    offscreenPromise = null;
}

export async function ensureOffscreenRunning() {
    // While creation is in flight the context already exists but has no message listener yet, so wait for READY first
    if (offscreenPromise) {
        await offscreenPromise;
        return;
    }

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
        offscreenTimeout = setTimeout(onOffscreenTimeout, 5000);
        chrome.runtime.onMessage.addListener(onOffscreenReady);
        chrome.offscreen.createDocument({
            url: path,
            reasons: ["WORKERS"],
            justification: "Offscreen document is used for running PXE in it",
        }).catch((error: Error) => {
            chrome.runtime.onMessage.removeListener(onOffscreenReady);
            clearTimeout(offscreenTimeout);
            rejectOffscreenPromise(`Failed to create offscreen document: ${error.message}`);
            offscreenPromise = null;
        });
    }

    await offscreenPromise;
}
