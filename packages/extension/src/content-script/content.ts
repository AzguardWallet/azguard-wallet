/**
 * Content script — pure relay between page (postMessage/MessagePort) and
 * background (chrome.runtime.sendMessage).
 *
 * Uses the standardized @aztec/wallet-sdk ContentScriptConnectionHandler
 * which handles discovery, MessageChannel creation, key exchange relay,
 * and encrypted message relay. No private keys or secrets touch this script.
 */
import { ContentScriptConnectionHandler } from "@aztec/wallet-sdk/extension/handlers"

const handler = new ContentScriptConnectionHandler({
	sendToBackground: (message) => chrome.runtime.sendMessage(message),
	addBackgroundListener: (listener) => {
		// biome-ignore lint/suspicious/noExplicitAny: Chrome message listener provides untyped messages
		chrome.runtime.onMessage.addListener((message: any) => {
			listener(message)
			return undefined
		})
	},
})

handler.start()
