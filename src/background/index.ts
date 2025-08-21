import { init, start } from "@/wallet"

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

;(async function startWallet() {
	await init()
	start()
})()

export {}
