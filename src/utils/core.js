import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { ContactServiceClient } from "@/wallet/services/contact/client"

export const isBackgroundConnected = ref(false)
const onConnected = () => {
	isBackgroundConnected.value = true
}
const onDisconnected = () => {
	isBackgroundConnected.value = false
}

const profileService = new ProfileServiceClient()
profileService.onConnected.add(onConnected)
profileService.onDisconnected.add(onDisconnected)
profileService.connect()

const contactService = new ContactServiceClient()
contactService.connect()

export const managers = {
	profile: profileService,
	network: null, // must be initialized after profile.onActiveProfileChanged
	transaction: null,
	contact: contactService,
}

export async function refreshBalances(minutes) {
	const tokenBalanceService = new TokenBalanceServiceClient()
	const tokenBalances = await tokenBalanceService.getTokenBalances()

	function checkAge(updatedAt, minutes) {
		if (!minutes) return true

		const now = Date.now()
		const diff = now - updatedAt
		return diff >= minutes * 60 * 1_000
	}

	tokenBalances.forEach(tb => {
		if (checkAge(tb.updatedAt, minutes)) {
			tokenBalanceService.getTokenBalance(tb.id)
		}
	})

	tokenBalanceService.disconnect()
}

export const initTransactionService = (onTransactionAdded, onTransactionUpdated) => {
	if (managers.transaction) managers.transaction.disconnect()
	managers.transaction = new TransactionServiceClient()
	managers.transaction.onTransactionAdded.add(onTransactionAdded)
	managers.transaction.onTransactionUpdated.add(onTransactionUpdated)
	managers.transaction.connect()
}

const sentinelPath = "azguard:ui:sentinel"

export const setSentinel = async () => {
	await chrome.storage.local.set({ [sentinelPath]: __SENTINEL__ })
	chrome.storage.local.remove("azguard:ui:aztecVersion") // TODO: delete me at some point
}

export const checkSentinel = async () => {
	return (await chrome.storage.local.get(sentinelPath))[sentinelPath] === __SENTINEL__
}
