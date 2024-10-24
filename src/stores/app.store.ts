import { defineStore } from "pinia"

export const useAppStore = defineStore("app", () => {
	const balance = ref(0)

	return {
		balance,
	}
})
