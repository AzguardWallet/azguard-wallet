import type { Account } from "@/wallet/services/account/client"
import { NodeStatus } from "@/wallet/services/network/client"

import { defineStore } from "pinia"

type WalletMetadata = {
	created_at: number
}

export const useAppStore = defineStore("app", () => {
	const _isHomeScreenOpened = ref(false)

	const isLoading = ref(false)

	const isAwaitingTransaction = ref(false)

	const displayOption = ref("total_account_value")

	const profile = ref()
	const isRegistered = computed(() => !!profile.value)

	const account = ref<Account>()
	const accounts = ref<Account[]>([])
	const isLogined = ref<boolean>(false)
	const isSessionChecked = ref<boolean>(false)
	const pageAwaitingAuth = ref<string>("")

	const setupActiveAccount = async () => {
		const activeAccountResult = await chrome.storage.local.get("azguard:ui:activeAccount")
		if ("azguard:ui:activeAccount" in activeAccountResult) {
			const activeAccountAddress = activeAccountResult["azguard:ui:activeAccount"]
			const activeAccount = accounts.value.find(a => a.address === activeAccountAddress)
			if (activeAccount) {
				account.value = activeAccount
				return
			}
		}
		account.value = accounts.value[0]
		await chrome.storage.local.set({
			"azguard:ui:activeAccount": account.value?.address,
		})
	}
	const selectAccount = async (acc: Account) => {
		account.value = acc
		await chrome.storage.local.set({
			"azguard:ui:activeAccount": acc.address,
		})
	}
	const changeAccountVisibility = async (acc: Account, value: boolean) => {
		const accIdx = accounts.value.findIndex(a => acc.address === a.address)

		managers.account.changeAccountVisibility(acc.address, value)
		accounts.value[accIdx] = { ...acc, visible: value }

		if (!value) {
			if (accounts.value.length) {
				account.value = accounts.value.filter(a => a.visible).sort((a, b) => a.index - b.index)[0]
				await chrome.storage.local.set({
					"azguard:ui:activeAccount": account.value?.address,
				})
			}
		}
	}
	const updateAccount = async (address: string, name: string) => {
		const accIdx = accounts.value.findIndex(a => address === a.address)

		await managers.account.changeAccountName(address, name)

		const updatedAccount = { ...accounts.value[accIdx], name: name }
		accounts.value[accIdx] = updatedAccount
		if (address === account.value?.address) {
			account.value = updatedAccount
		}
	}

	const tokens = ref([])
	const syncLocalTokens = async () => {
		const rawTokens = await managers.token?.getTokens()
		tokens.value = rawTokens?.length ? rawTokens.filter(t => t.chainId == network.value.chainId) : []
	}

	const tokenAwaitingBalanceIdx = ref()
	const isBalancesSynced = ref(false)
	const balances = ref([])
	const accountTotalBalance = computed(() => {
		if (!balances.value.length) return 0

		return balances.value
			.filter(b => b.account === account.value?.address)
			.reduce((acc, curr) => {
				const tokenBalance = Number.parseFloat(curr.privateBalance) + Number.parseFloat(curr.publicBalance)
				return acc + tokenBalance
			}, 0)
	})
	const syncBalances = async () => {
		if (!tokens.value.length) return
		balances.value = []

		for (const token of tokens.value) {
			const tokenBalance = (await managers.balance.getTokenBalances(token.id, account.value?.address))[0]
			if (tokenBalance) balances.value.push(tokenBalance)
		}

		isBalancesSynced.value = true
	}
	const initBalanceListeners = () => {
		managers.balance.onTokenBalanceUpdated = newBalance => {
			if (newBalance.token.id === tokenAwaitingBalanceIdx.value) {
				tokenAwaitingBalanceIdx.value = null
			}

			console.log(newBalance)

			const oldBalanceIdx = balances.value.findIndex(b => b.id === newBalance.id)
			if (oldBalanceIdx === -1) {
				balances.value.push(newBalance)
			} else {
				balances.value[oldBalanceIdx] = newBalance
			}
		}
	}

	const network = ref()
	const networkStatus = ref()
	const networks = ref([])

	const syncNetworkStatus = async () => {
		networkStatus.value = "sync"
		const status = await managers.network.getNodeStatus(network.value.id)
		networkStatus.value = NodeStatus[status]
	}
	const updateNetwork = async (id, name, url) => {
		await managers.network.updateNetwork(id, name, url)
		networks.value = await managers.network.getNetworks()
	}
	const removeNetwork = async target => {
		await managers.network.deleteNetwork(target.id)
		networks.value = networks.value.filter(n => n.id !== target.id)
	}

	const transactions = ref([])
	const syncTransactions = async () => {
		transactions.value = (await managers.transaction.getTransactions(account.value))
			.filter(t => t.account === account.value.address)
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	const dappSessions = ref([])

	const showSendPopup = ref(false)
	const showRegisterPopup = ref(false)

	const isPrivacyModeEnabled = ref(false)

	return {
		_isHomeScreenOpened,
		isLoading,
		isAwaitingTransaction,
		displayOption,
		profile,
		isRegistered,
		account,
		isLogined,
		isSessionChecked,
		pageAwaitingAuth,
		accounts,
		setupActiveAccount,
		selectAccount,
		changeAccountVisibility,
		updateAccount,
		tokens,
		syncLocalTokens,
		tokenAwaitingBalanceIdx,
		isBalancesSynced,
		balances,
		accountTotalBalance,
		syncBalances,
		initBalanceListeners,
		network,
		networkStatus,
		syncNetworkStatus,
		networks,
		dappSessions,
		updateNetwork,
		removeNetwork,
		transactions,
		syncTransactions,
		showSendPopup,
		showRegisterPopup,
		isPrivacyModeEnabled,
	}
})
