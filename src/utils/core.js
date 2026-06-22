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
	// network/transaction are assigned during startup (app.vue) before any consumer reads them,
	// so they are cast to their non-null client type to match real usage.
	network: /** @type {import("@/wallet/services/network/client").NetworkServiceClient} */ (null), // must be initialized after profile.onActiveProfileChanged
	transaction: /** @type {import("@/wallet/services/transaction/client").TransactionServiceClient} */ (null),
	contact: contactService,
}

export async function refreshBalances(minutes, accounts) {
	if (!accounts?.length) return

	const tokenBalanceService = new TokenBalanceServiceClient()
	const tokenBalances = []
	for (const acc of accounts) {
		tokenBalances.push(...(await tokenBalanceService.getTokenBalances(undefined, acc.address)));
	}

	function checkAge(updatedAt, minutes) {
		if (!minutes) return true

		const now = Date.now()
		const diff = now - updatedAt
		return diff >= minutes * 60 * 1_000
	}

	for (const tb of tokenBalances) {
		if (checkAge(tb.updatedAt, 30)) tokenBalanceService.refreshTokenBalance(tb.id)
	}

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
