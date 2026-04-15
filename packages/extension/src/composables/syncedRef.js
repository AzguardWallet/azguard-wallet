const STORAGE_PREFIX = "nulo:ui:"

export function useSyncedRef(key, defaultValue) {
	const storageKey = STORAGE_PREFIX + key
	const state = ref(defaultValue)

	chrome.storage.local.get([storageKey], (result) => {
		if (result[storageKey] !== undefined) {
			state.value = result[storageKey]
		}
	})

	watch(state, (newVal) => {
		chrome.storage.local.set({ [storageKey]: newVal })
	})

	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === "local" && changes[storageKey]) {
			state.value = changes[storageKey].newValue
		}
	})

	return state
}
