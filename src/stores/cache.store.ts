import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	const networkToEditIdx = ref()
	const accountToEditIdx = ref()
	const tokenToEditIdx = ref()
	const fpcToEditIdx = ref()

	const activeTokenIdx = ref()
	const activeTxHash = ref()
	const activeNote = ref()
	const preselectedBalanceType = ref("private")
	const preselectedTokenAddressToAdd = ref()

	const proposedNetworks = ref([])
	const selectedNetwork = ref()
	const feePaymentMethods = ref([])

	const claimParameters = ref()

	const importType = ref("")

	return {
		confirm,
		networkToEditIdx,
		accountToEditIdx,
		tokenToEditIdx,
		fpcToEditIdx,
		activeTokenIdx,
		activeTxHash,
		activeNote,
		proposedNetworks,
		selectedNetwork,
		preselectedBalanceType,
		preselectedTokenAddressToAdd,
		feePaymentMethods,
		claimParameters,
		importType,
	}
})
