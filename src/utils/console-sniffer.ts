const pendingLogs: any[][] = []

for (const method of ["trace", "debug", "log", "info", "warn", "error"] as const) {
	const original = console[method].bind(console)
	console[`_${method}`] = original
	console[method] = (...args: any[]) => {
		const overriden = self[`on${method}`]
		if (!overriden) {
			pendingLogs.push(args)
			return
		}
		if (pendingLogs.length) {
			for (const data of pendingLogs) {
				try {
					overriden(...data)
				} catch (error) {
					original(`Error in self.on${method}`, error)
					original(...data)
				}
			}
			pendingLogs.splice(0)
		}
		try {
			overriden(...args)
		} catch (error) {
			original(`Error in self.on${method}`, error)
			original(...args)
		}
	}
}
