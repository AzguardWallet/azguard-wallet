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
