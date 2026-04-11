export const isPrefersDarkScheme = () => {
	return window.matchMedia("(prefers-color-scheme: dark)")?.matches
}

export const debounce = (fn, delay) => {
	let timeout

	return (...args) => {
		clearTimeout(timeout)
		timeout = setTimeout(() => {
			fn(...args)
		}, delay)
	}
}

export async function ensurePermissions(perms) {
	return new Promise((resolve) => {
		chrome.permissions.contains(perms, (has) => {
			if (has) return resolve(true)

			chrome.permissions.request(perms, (granted) => {
				resolve(Boolean(granted))
			})
		})
	})
}
