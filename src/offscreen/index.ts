window.console.log = (...data) => {
	chrome.runtime.sendMessage({
		type: "CONSOLE_LOG",
		data,
	})
}
