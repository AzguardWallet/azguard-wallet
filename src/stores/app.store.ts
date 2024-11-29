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

	const profile = ref()

	const account = ref<Account>()
	const isLogined = ref<boolean>(false)
	const accounts = ref<Account[]>([])
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
	const hideAccount = async (acc: Account) => {
		const accIdx = accounts.value.findIndex(
			(a) => acc.address === a.address
		)

		managers.account.changeAccountVisibility(acc, false)
		accounts.value.splice(accIdx, 1)

		if (accounts.value.length) {
			account.value = accounts.value[0]
			await chrome.storage.local.set({
				"azguard:ui:activeAccount": account.value?.address,
			})
		}
	}

	const tokens = ref([])
	const syncLocalTokens = async () => {
		tokens.value = await managers.token.getTokens()
	}

	const network = ref()
	const networks = ref([])

	const dappSessions = ref([])

	const showSendPopup = ref(false)
	const showRegisterPopup = ref(false)

	const isPrivacyModeEnabled = ref(false)

	return {
		_wallet,
		setWalletCreatedAt,
		_isHomeScreenOpened,
		profile,
		account,
		isLogined,
		accounts,
		setupActiveAccount,
		selectAccount,
		hideAccount,
		tokens,
		syncLocalTokens,
		network,
		networks,
		dappSessions,
		showSendPopup,
		showRegisterPopup,
		isPrivacyModeEnabled,
	}
})
