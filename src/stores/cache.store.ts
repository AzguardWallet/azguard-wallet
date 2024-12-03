import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	const networkToEditIdx = ref()
	const accountToEditIdx = ref()

	const activeTokenIdx = ref()
	const activeTxHash = ref()
	const preselectedBalanceType = ref("private")

	const proposedNetworks = ref([])
	const selectedNetwork = ref()

	return {
		confirm,
		networkToEditIdx,
		accountToEditIdx,
		activeTokenIdx,
		activeTxHash,
		proposedNetworks,
		selectedNetwork,
		preselectedBalanceType,
	}
})
