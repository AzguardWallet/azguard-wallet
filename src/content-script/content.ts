// @ts-ignore
import inpageScript from "./inpage?script&module";
import { ProxyServer } from "./proxy/server";
import { ContentScriptConnectionHandler, MessageOrigin } from "@aztec/wallet-sdk/extension/handlers";

const _ = new ProxyServer();

const script = document.createElement("script");
script.setAttribute("id", "azguard-inpage-script");
script.setAttribute("src", chrome.runtime.getURL(inpageScript));
script.setAttribute("type", "module");

const container = document.head || document.documentElement;
container.insertBefore(script, container.children[0]);

// Aztec Wallet SDK relay — forwards encrypted messages between dApp and background.
// Only SDK protocol messages (origin === 'background') are forwarded to the handler;
// other chrome.tabs.sendMessage() calls from the background must not reach SDK code.
const sdkHandler = new ContentScriptConnectionHandler({
    sendToBackground: message => chrome.runtime.sendMessage(message),
    addBackgroundListener: listener => {
        chrome.runtime.onMessage.addListener((message) => {
            if (message?.origin === MessageOrigin.BACKGROUND) {
                listener(message);
            }
            return undefined;
        });
    },
});
sdkHandler.start();
