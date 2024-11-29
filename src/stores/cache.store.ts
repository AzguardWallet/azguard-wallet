import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	return { confirm }
})
