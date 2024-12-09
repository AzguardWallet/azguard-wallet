import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	const networkToEditIdx = ref()
	const accountToEditIdx = ref()
	const tokenToEditIdx = ref()

	const activeTokenIdx = ref()
	const activeTxHash = ref()
	const preselectedBalanceType = ref("private")

	return {
		confirm,
		networkToEditIdx,
		accountToEditIdx,
		tokenToEditIdx,
		activeTokenIdx,
		activeTxHash,
		preselectedBalanceType,
	}
})
