import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	const networkToEditIdx = ref()
	const accountToEditIdx = ref()

	const activeTokenIdx = ref()

	return { confirm, networkToEditIdx, accountToEditIdx, activeTokenIdx }
})
