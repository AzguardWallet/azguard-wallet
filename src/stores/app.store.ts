/** Vendor */
import { defineStore } from "pinia"

import type { Account } from "@/wallet/services/account/client"
import { NodeStatus } from "@/wallet/services/network/client"

import { useSyncedRef } from "@/composables/syncedRef.js"

type WalletMetadata = {
	created_at: number
}

class AccountTokenMap {
	private map: Map<string, true> = new Map();

	private makeKey(account: string, tokenId: string): string {
		return `${account}|${tokenId}`;
	}

	add(account: string, tokenId: string): void {
		this.map.set(this.makeKey(account, tokenId), true);
	}

	has(account: string, tokenId: string): boolean {
		return this.map.has(this.makeKey(account, tokenId));
	}

	remove(account: string, tokenId: string): void {
		this.map.delete(this.makeKey(account, tokenId));
	}

	clear(): void {
		this.map.clear();
	}

	size(): number {
		return this.map.size;
	}
}

export const useAppStore = defineStore("app", () => {
	const _isHomeScreenOpened = ref(false)

	const isLoading = ref(false)

	const displayOption = ref("total_account_value")

	const profile = ref()
	const profiles = ref([])

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

		await managers.account.changeAccountVisibility(profile.value.id, network.value.id, acc.address, value)
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

		await managers.account.changeAccountName(profile.value.id, network.value.id, address, name)

		const updatedAccount = { ...accounts.value[accIdx], name: name }
		accounts.value[accIdx] = updatedAccount
		if (address === account.value?.address) {
			account.value = updatedAccount
		}
	}

	const tokens = ref([])
	const tokensAwaitingBalanceRefresh = ref(new AccountTokenMap())
	const mintingTokens	= ref(new AccountTokenMap())
	const dummyTokens = ref([])
	const onTokenAdded = token => {
		const dummyTokenIdx = dummyTokens.value.findLastIndex(t => t.id === -1)
		if (dummyTokenIdx !== -1) dummyTokens.value.splice(dummyTokenIdx, 1)
		
		const tokenIdx = tokens.value.findIndex(t => t.id ===  token.id)
		if (tokenIdx === -1) tokens.value.push(token)
	}
	const syncLocalTokens = async () => {
		const rawTokens = await managers.token?.getTokens(profile.value.id, network.value.chainId)
		tokens.value = rawTokens?.length ? rawTokens.filter(t => t.chainId == network.value.chainId) : []
	}

	const isBalancesSynced = ref(false)
	const balances = ref([])

	function checkAge(updatedAt: number, minutes?: number): boolean {
		if (!minutes) return true;

		const now = Date.now();
		const diff = now - updatedAt;
		return diff >= minutes * 60 * 1000;
	}

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
	const refreshBalances = async (minutes) => {
		let balances_ = []
		for (const tkn of tokens.value) {
			if (tokensAwaitingBalanceRefresh.value.has(account.value.address, tkn.id)) continue

			const balance = await managers.balance.getTokenBalances(tkn.id, account.value.address)
			if (balance.length && checkAge(balance[0]?.updatedAt, minutes)) {
				balances_ = [...balances_, ...balance]
				tokensAwaitingBalanceRefresh.value.add(account.value.address, tkn.id)
			}
		}

		if (balances_.length) {
			for (const balance of balances_) {
				managers.balance.refreshTokenBalance(balance.id)
			}
		}
	}
	const initBalanceListeners = () => {
		// TODO: make sure to not add duplicated listeners
		managers.balance.onTokenBalanceUpdated.add(newBalance => {
			const tokens_ = tokens.value.filter(t => t.name === newBalance.token.name && t.symbol === newBalance.token.symbol && t.chainId === newBalance.token.chainId)
			tokens_.forEach(t => {
				tokensAwaitingBalanceRefresh.value.remove(newBalance.account, t.id)
			})

			const oldBalanceIdx = balances.value.findIndex(b => b.id === newBalance.id)
			if (oldBalanceIdx === -1) {
				balances.value.push(newBalance)
			} else {
				balances.value[oldBalanceIdx] = newBalance
			}
		})
	}

	const network = ref()
	const networkStatus = ref()
	const networks = ref([])

	const syncNetworkStatus = async () => {
		networkStatus.value = "sync"
		const oldNetworkId = network.value?.id
		const status = await managers.network.getNodeStatus(network.value.id)
		
		if (oldNetworkId !== network.value?.id) return
		
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

	const awaitingTransactions = ref([])
	const transactions = ref([])
	const onTxAdded = async (tx) => {
		transactions.value.unshift(tx)
		const call = tx.calls[0]
		const destination = call?.transfers?.length ? call?.transfers[0].to : call?.args[1]
		const awaitingTxIdx = awaitingTransactions.value.findIndex(t => t.account === tx.account && t.contract === call?.contract && t.destination === destination)
		if (awaitingTxIdx > -1) {
			awaitingTransactions.value.splice(awaitingTxIdx, 1)
			const token = tokens.value.find(t => t.contract === call?.contract)
			if (token?.id) {
				const balanceFrom = await managers.balance.getTokenBalances(token.id, tx.account)
				if (balanceFrom[0]?.id && !tokensAwaitingBalanceRefresh.value.has(balanceFrom[0]?.account, token.id)) {
					tokensAwaitingBalanceRefresh.value.add(balanceFrom[0]?.account, token.id)
					managers.balance.refreshTokenBalance(balanceFrom[0].id)
				}
				
				const balanceTo = await managers.balance.getTokenBalances(token.id, destination)
				if (balanceTo[0]?.id && !tokensAwaitingBalanceRefresh.value.has(balanceTo[0]?.account, token.id)) {
					tokensAwaitingBalanceRefresh.value.add(balanceTo[0]?.account, token.id)
					managers.balance.refreshTokenBalance(balanceTo[0].id)
				}
			}
		}
	}
	const onTxUpdated = tx => {
		const ind = transactions.value.findIndex(x => x.hash === tx.hash);
		if (ind !== -1) {
			transactions.value.splice(ind, 1, tx);
		}
	}
	const syncTransactions = async () => {
		if (!account.value || !managers.transaction) return
		
		transactions.value = (await managers.transaction.getTransactions(account.value?.address))
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	const dappSessions = ref([])

	const showSendPopup = ref(false)
	const showRegisterPopup = ref(false)

	const isPrivacyModeEnabled = ref(false)

	const loggerWindowId = useSyncedRef("loggerWindowId", null)

	return {
		_isHomeScreenOpened,
		isLoading,
		awaitingTransactions,
		displayOption,
		profile,
		profiles,
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
		mintingTokens,
		dummyTokens,
		onTokenAdded,
		syncLocalTokens,
		tokensAwaitingBalanceRefresh,
		isBalancesSynced,
		balances,
		accountTotalBalance,
		syncBalances,
		refreshBalances,
		initBalanceListeners,
		network,
		networkStatus,
		syncNetworkStatus,
		networks,
		dappSessions,
		updateNetwork,
		removeNetwork,
		transactions,
		onTxAdded,
		onTxUpdated,
		syncTransactions,
		showSendPopup,
		showRegisterPopup,
		isPrivacyModeEnabled,
		loggerWindowId,
	}
})
