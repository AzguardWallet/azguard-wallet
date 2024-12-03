import type { Account } from "@/wallet/services/account/client"

import { defineStore } from "pinia"

type WalletMetadata = {
	created_at: number
}

export const useAppStore = defineStore("app", () => {
	const _wallet = reactive<WalletMetadata>({
		created_at: 0,
	})
	const setWalletCreatedAt = async () => {
		const profileCreatedAtResult = await chrome.storage.local.get(
			`azguard:ui:profileCreatedAt@${profile.value.id}`
		)
		if (
			`azguard:ui:profileCreatedAt@${profile.value.id}` in
			profileCreatedAtResult
		) {
			_wallet.created_at =
				profileCreatedAtResult[
					`azguard:ui:profileCreatedAt@${profile.value.id}`
				]
		}
	}

	const _isHomeScreenOpened = ref(false)

	const isLoading = ref(false)

	const isAwaitingTransaction = ref(false)

	const profile = ref()

	const account = ref<Account>()
	const accounts = ref<Account[]>([])
	const isLogined = ref<boolean>(false)
	const isSessionChecked = ref<boolean>(false)
	const pageAwaitingAuth = ref<string>("")

	const setupActiveAccount = async () => {
		const activeAccountResult = await chrome.storage.local.get(
			"azguard:ui:activeAccount"
		)
		if ("azguard:ui:activeAccount" in activeAccountResult) {
			const activeAccountAddress =
				activeAccountResult["azguard:ui:activeAccount"]
			const activeAccount = accounts.value.find(
				(a) => a.address === activeAccountAddress
			)
			if (activeAccount) {
				account.value = activeAccount
			} else {
				account.value = accounts.value[0]
				await chrome.storage.local.set({
					"azguard:ui:activeAccount": account.value?.address,
				})
			}
		}
	}
	const selectAccount = async (acc: Account) => {
		account.value = acc
		await chrome.storage.local.set({
			"azguard:ui:activeAccount": acc.address,
		})
	}
	const changeAccountVisibility = async (acc: Account, value: boolean) => {
		const accIdx = accounts.value.findIndex(
			(a) => acc.address === a.address
		)

		managers.account.changeAccountVisibility(acc.address, value)
		accounts.value[accIdx] = { ...acc, visible: value }

		if (!value) {
			if (accounts.value.length) {
				account.value = accounts.value
					.filter((a) => a.visible)
					.sort((a, b) => a.index - b.index)[0]
				await chrome.storage.local.set({
					"azguard:ui:activeAccount": account.value?.address,
				})
			}
		}
	}
	const updateAccount = async (address: string, name: string) => {
		const accIdx = accounts.value.findIndex((a) => address === a.address)

		await managers.account.changeAccountName(address, name)

		const updatedAccount = { ...accounts.value[accIdx], name: name }
		accounts.value[accIdx] = updatedAccount
		if (address === account.value?.address) {
			account.value = updatedAccount
		}
	}

	const tokens = ref([])
	const syncLocalTokens = async () => {
		tokens.value = await managers.token?.getTokens()
	}

	const tokenAwaitingBalanceIdx = ref()
	const balances = ref([])
	const accountTotalBalance = computed(() => {
		if (!balances.value.length) return 0

		return balances.value
			.filter((b) => b.account === account.value?.address)
			.reduce((acc, curr) => {
				const tokenBalance =
					Number.parseFloat(curr.privateBalance) +
					Number.parseFloat(curr.publicBalance)
				return acc + tokenBalance
			}, 0)
	})
	const syncBalances = async () => {
		if (!tokens.value.length) return

		for (const token of tokens.value) {
			const tokenBalance = (
				await managers.balance.getTokenBalances(
					token.id,
					account.value?.address
				)
			)[0]
			balances.value.push(tokenBalance)
		}
	}
	const initBalanceListeners = () => {
		managers.balance.onTokenBalanceUpdated = (newBalance) => {
			tokenAwaitingBalanceIdx.value = null

			console.log(newBalance)
			console.log(balances.value)

			const oldBalanceIdx = balances.value.findIndex(
				(b) => b.id === newBalance.id
			)
			if (oldBalanceIdx === -1) {
				balances.value.push(newBalance)
			} else {
				balances.value[oldBalanceIdx] = newBalance
			}
		}
	}

	const network = ref()
	const networks = ref([])

	const dappSessions = ref([])
	const updateNetwork = async (id, name, url) => {
		await managers.network.updateNetwork(id, name, url)
		networks.value = await managers.network.getNetworks()
	}
	const removeNetwork = async (target) => {
		await managers.network.deleteNetwork(target.id)
		networks.value = networks.value.filter((n) => n.id !== target.id)
	}

	const transactions = ref([])
	const syncTransactions = async () => {
		transactions.value = (
			await managers.transaction.getTransactions(account.value)
		)
			.filter((t) => t.account === account.value.address)
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	const showSendPopup = ref(false)
	const showRegisterPopup = ref(false)

	const isPrivacyModeEnabled = ref(false)

	return {
		_wallet,
		setWalletCreatedAt,
		_isHomeScreenOpened,
		isLoading,
		isAwaitingTransaction,
		profile,
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
		balances,
		accountTotalBalance,
		syncBalances,
		initBalanceListeners,
		network,
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
