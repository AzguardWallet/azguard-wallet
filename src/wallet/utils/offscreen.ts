export const OFFSCREEN_READY_MESSAGE = "OFFSCREEN_READY";
export const OFFSCREEN_PING = "OFFSCREEN_PING";
export const OFFSCREEN_PONG = "OFFSCREEN_PONG";
export const OFFSCREEN_KEEPALIVE = "OFFSCREEN_KEEPALIVE";

let offscreenTimeout: NodeJS.Timeout;
let offscreenPromise: Promise<void> | null = null;
let resolveOffscreenPromise: () => void;
let rejectOffscreenPromise: (reason: string) => void;

const HEALTH_CHECK_TIMEOUT_MS = 3_000;
const READY_TIMEOUT_MS = 10_000;

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
    // Kill the half-initialized offscreen so it doesn't become a ghost
    chrome.offscreen.closeDocument().catch(() => {});
    rejectOffscreenPromise("Offscreen is not responding");
    offscreenPromise = null;
}

/**
 * Check if the existing offscreen document is responsive.
 * Sends a ping and waits for a pong within HEALTH_CHECK_TIMEOUT_MS.
 * Returns true if healthy, false if zombie/unresponsive.
 */
async function isOffscreenHealthy(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
            chrome.runtime.onMessage.removeListener(onPong);
            resolve(false);
        }, HEALTH_CHECK_TIMEOUT_MS);

        const onPong = (message: any) => {
            if (message === OFFSCREEN_PONG) {
                chrome.runtime.onMessage.removeListener(onPong);
                clearTimeout(timer);
                resolve(true);
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(onPong);
        chrome.runtime.sendMessage(OFFSCREEN_PING).catch(() => {
            // No receiver — offscreen is definitely dead
            chrome.runtime.onMessage.removeListener(onPong);
            clearTimeout(timer);
            resolve(false);
        });
    });
}

/**
 * Close any existing offscreen document, ignoring errors.
 */
async function closeOffscreen() {
    try {
        await chrome.offscreen.closeDocument();
    } catch {
        // Already closed or Chrome cleaned it up
    }
}

/**
 * Create the offscreen document. Handles the Chrome ghost bug where
 * getContexts() returns empty but createDocument() throws "already exists".
 */
async function createOffscreen() {
    try {
        await chrome.offscreen.createDocument({
            url: path,
            reasons: ["WORKERS"],
            justification: "Offscreen document is used for running PXE in it",
        });
    } catch (err) {
        if (String(err).includes("single offscreen document")) {
            // Ghost offscreen — close it and retry once
            await closeOffscreen();
            await chrome.offscreen.createDocument({
                url: path,
                reasons: ["WORKERS"],
                justification: "Offscreen document is used for running PXE in it",
            });
        } else {
            throw err;
        }
    }
}

export async function ensureOffscreenRunning() {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
        // Offscreen exists — verify it's actually responsive
        if (await isOffscreenHealthy()) {
            return;
        }
        // Zombie offscreen — kill it and recreate below
        await closeOffscreen();
    }

    if (!offscreenPromise) {
        offscreenPromise = new Promise((resolve, reject) => {
            resolveOffscreenPromise = resolve;
            rejectOffscreenPromise = reject;
        });
        offscreenTimeout = setTimeout(onOffscreenTimeout, READY_TIMEOUT_MS);
        chrome.runtime.onMessage.addListener(onOffscreenReady);
        try {
            await createOffscreen();
        } catch (err) {
            clearTimeout(offscreenTimeout);
            chrome.runtime.onMessage.removeListener(onOffscreenReady);
            offscreenPromise = null;
            throw err;
        }
    }

    await offscreenPromise;
}
