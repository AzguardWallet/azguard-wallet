/** Vendor */
import { defineStore } from "pinia"

import type { Account } from "@/wallet/services/account/client"
import { NodeStatus } from "@/wallet/services/network/client"
import { Tx, TxStatus } from "@/wallet/services/transaction/client"
import { isLocalTx } from "@/wallet/services/transaction/spec"
import type { Network } from "@/wallet/services/network/spec"
import type { BlockExplorerType } from "@/wallet/constants/explorers"

import { useSyncedRef } from "@/composables/syncedRef.js"

type WalletMetadata = {
	created_at: number
}

/** A pending send shown in "recent activity" until the matching tx is observed. */
type AwaitingTx = {
	account: string
	contract: string
	destination: string
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

	async function onAccountAdded(acc: Account) {
		const idx = accounts.value.findIndex(a => a.address === acc.address)
		if (idx !== -1) return

		accounts.value.push(acc)

		if (account.value?.address === acc.address) {
			await selectAccount(acc)
		}
	}

	async function onAccountUpdated(acc: Account) {
		const idx = accounts.value.findIndex(a => a.address === acc.address)
		if (idx === -1) return
		
		accounts.value[idx] = acc

		if (account.value?.address === acc.address) {
			if (acc.visible) {
				await selectAccount(acc)
			} else {
				const nextAccount = accounts.value.filter(a => a.address !== acc.address && a.visible).at(0)
				if (nextAccount) {
					await selectAccount(nextAccount)
				}
			}
		}
	}

	async function onAccountDeleted(acc: Account) {
		const idx = accounts.value.findIndex(a => a.address === acc.address)
		if (idx === -1) return
		
		accounts.value.splice(idx, 1)

		if (account.value?.address === acc.address) {
			const nextAccount = accounts.value.filter(a => a.address !== acc.address && a.visible).at(0)
			if (nextAccount) {
				account.value = nextAccount
				await setActiveAccount(nextAccount.address)
			}
		}
	}

	const activeAccountKey = computed(() => `azguard:ui:activeAccount@${profile.value?.id}`)
	async function setActiveAccount(address?: string) {
		if (!address || !profile.value?.id) return

		await chrome.storage.local.set({ [activeAccountKey.value]: address })
	}
	const setupActiveAccount = async () => {
		const activeAccountAddress = (await chrome.storage.local.get(activeAccountKey.value))[activeAccountKey.value]
		const activeAccount = accounts.value.find(a => a.address === activeAccountAddress)
		if (activeAccount) {
			account.value = activeAccount
			return
		}

		account.value = accounts.value[0]
		await setActiveAccount(account.value?.address)
	}
	const selectAccount = async (acc: Account) => {
		account.value = acc
		await setActiveAccount(account.value?.address)
	}

	const network = ref()
	const networkStatus = ref()
	const networks = ref<Network[]>([])

	const syncNetworkStatus = async () => {
		networkStatus.value = "sync"
		const oldNetworkId = network.value?.id
		const status = await managers.network.getNodeStatus(network.value.id)
		
		if (oldNetworkId !== network.value?.id) return
		
		networkStatus.value = NodeStatus[status]
	}
	const updateNetwork = async (id: string, name: string, url: string) => {
		await managers.network.updateNetwork(id, name, url)
		networks.value = await managers.network.getNetworks()
	}
	const removeNetwork = async (target: Network) => {
		await managers.network.deleteNetwork(target.id)
		networks.value = networks.value.filter(n => n.id !== target.id)
	}

	const awaitingTransactions = ref<AwaitingTx[]>([])
	const transactions = ref<Tx[]>([])
	const cancellingTxs = computed(() => {
		return transactions.value.filter(t => t.status === TxStatus.Cancelling)
	})
	const onTxAdded = async (tx: Tx) => {
		transactions.value.unshift(tx)
		const call = isLocalTx(tx) ? tx.calls[0] : undefined
		const destination = call?.transfers?.[0]?.to ?? call?.args?.[1]
		const awaitingTxIdx = awaitingTransactions.value.findIndex(t => t.account === tx.account && t.contract === call?.contract && t.destination === destination)
		if (awaitingTxIdx > -1) {
			awaitingTransactions.value.splice(awaitingTxIdx, 1)
		}
	}
	const onTxUpdated = (tx: Tx) => {
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

	const defaultExplorer = ref<BlockExplorerType | null>("aztecscan")

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
		onAccountAdded,
		onAccountUpdated,
		onAccountDeleted,
		setActiveAccount,
		setupActiveAccount,
		selectAccount,
		network,
		networkStatus,
		syncNetworkStatus,
		networks,
		dappSessions,
		updateNetwork,
		removeNetwork,
		transactions,
		cancellingTxs,
		onTxAdded,
		onTxUpdated,
		syncTransactions,
		showSendPopup,
		showRegisterPopup,
		isPrivacyModeEnabled,
		defaultExplorer,
		loggerWindowId,
	}
})
