// biome-ignore lint/suspicious/noExplicitAny: console.* genuinely accepts any arguments
const pendingLogs: any[][] = []

for (const method of ["trace", "debug", "log", "info", "warn", "error"] as const) {
	const original = console[method].bind(console)
	console[`_${method}`] = original
	// biome-ignore lint/suspicious/noExplicitAny: console.* genuinely accepts any arguments
	console[method] = (...args: any[]) => {
		const overridden = self[`on${method}`]
		if (!overridden) {
			pendingLogs.push(args)
			return
		}
		if (pendingLogs.length) {
			for (const data of pendingLogs) {
				try {
					overridden(...data)
				} catch (error) {
					original(`Error in self.on${method}`, error)
					original(...data)
				}
			}
			pendingLogs.splice(0)
		}
		try {
			overridden(...args)
		} catch (error) {
			original(`Error in self.on${method}`, error)
			original(...args)
		}
	}
}
