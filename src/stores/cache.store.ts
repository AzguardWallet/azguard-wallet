import { defineStore } from "pinia"

export const useCacheStore = defineStore("cache", () => {
	const confirm = reactive({})

	const networkToEditIdx = ref()
	const accountToEditIdx = ref()
	const contactToEditIdx = ref()
	const tokenToEditIdx = ref()
	const fpcToEditIdx = ref()

	const activeTokenIdx = ref()
	const activeTxHash = ref()
	const activeNote = ref()
	const preselectedBalanceType = ref("private")
	const preselectedContactToSend = ref(null)
	const preselectedTokenAddressToAdd = ref()

	const proposedNetworks = ref([])
	const selectedNetwork = ref()
	const feePaymentMethods = ref([])

	const claimParameters = ref()

	const importType = ref("")

	const importContact = ref(null)
	const importContacts = ref([])
    const importPromise = ref(null)

	const failureLog = ref()

	return {
		confirm,
		networkToEditIdx,
		accountToEditIdx,
		contactToEditIdx,
		tokenToEditIdx,
		fpcToEditIdx,
		activeTokenIdx,
		activeTxHash,
		activeNote,
		proposedNetworks,
		selectedNetwork,
		preselectedBalanceType,
		preselectedContactToSend,
		preselectedTokenAddressToAdd,
		feePaymentMethods,
		claimParameters,
		importType,
		importContact,
		importContacts,
		importPromise,
		failureLog,
	}
})
