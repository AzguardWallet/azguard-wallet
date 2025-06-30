import { init, start } from "@/wallet"

// chrome.runtime.onMessage.addListener((
// 	msg: any,
// 	sender: chrome.runtime.MessageSender,
// 	sendResponse: (response?: any) => void
// ): boolean | undefined => {
// 	if (msg.type === 'LOG_ENTRY') {
// 		const now = Date.now();
// 		memoryLogs = memoryLogs.filter(e => now - e.ts <= LOG_TTL_MS);
// 		memoryLogs.push(msg.entry);
// 		if (memoryLogs.length > MAX_LOG_ENTRIES) {
// 			memoryLogs = memoryLogs.slice(-MAX_LOG_ENTRIES);
// 		}

// 		return false;
// 	}

// 	if (msg.type === 'GET_LOGS') {
// 		const count = (msg.count as number) || undefined;
// 		const out = count ? memoryLogs.slice(-count) : memoryLogs;

// 		sendResponse({ logs: out });

// 		return true;
// 	}

// 	return false;
// });

chrome.runtime.onInstalled.addListener(async (opt) => {
	// if (opt.reason === "install") {
	// 	await chrome.storage.local.clear()
	// 	chrome.tabs.create({
	// 		active: true,
	// 		url: chrome.runtime.getURL("src/setup/index.html?type=install"),
	// 	})
	// }
	// if (opt.reason === "update") {
	// 	chrome.tabs.create({
	// 		active: true,
	// 		url: chrome.runtime.getURL("src/setup/index.html?type=update"),
	// 	})
	// }
})

chrome.runtime.setUninstallURL("https://azguardwallet.io/forms/uninstall")

self.onerror = (message, source, lineno, colno, error) => {
	console.info(
		`Error: ${message}\nSource: ${source}\nLine: ${lineno}\nColumn: ${colno}\nError object: ${error}`
	)
}
;(async function startWallet() {
	await init()
	start()
})()

export {}
