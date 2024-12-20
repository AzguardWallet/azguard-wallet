export const isPrefersDarkScheme = () => {
	return window.matchMedia("(prefers-color-scheme: dark)")?.matches
}
