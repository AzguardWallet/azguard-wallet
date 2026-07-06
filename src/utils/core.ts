import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { SENTINEL_STORAGE_KEY, isCurrentGeneration, type ProfileInfo } from "@/wallet/services/profile/spec"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { TransactionServiceClient, type Tx } from "@/wallet/services/transaction/client"
import { ContactServiceClient } from "@/wallet/services/contact/client"
import type { NetworkServiceClient } from "@/wallet/services/network/client"
import type { TokenBalanceInfo } from "@/wallet/services/token-balance/spec"

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

type Managers = {
	profile: ProfileServiceClient
	/** Assigned during startup (app.vue) before any consumer reads it. */
	network: NetworkServiceClient
	transaction: TransactionServiceClient
	contact: ContactServiceClient
}

export const managers: Managers = {
	profile: profileService,
	network: null as unknown as NetworkServiceClient, // initialized after profile.onActiveProfileChanged
	transaction: null as unknown as TransactionServiceClient,
	contact: contactService,
}

export async function refreshBalances(minutes: number | undefined, accounts: ReadonlyArray<{ address: string }>) {
	if (!accounts?.length) return

	const tokenBalanceService = new TokenBalanceServiceClient()
	const tokenBalances: TokenBalanceInfo[] = []
	for (const acc of accounts) {
		tokenBalances.push(...(await tokenBalanceService.getTokenBalances(undefined, acc.address)))
	}

	function checkAge(updatedAt: number, minutes: number) {
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

export const initTransactionService = (
	onTransactionAdded: (tx: Tx) => void,
	onTransactionUpdated: (tx: Tx) => void,
) => {
	if (managers.transaction) managers.transaction.disconnect()
	managers.transaction = new TransactionServiceClient()
	managers.transaction.onTransactionAdded.add(onTransactionAdded)
	managers.transaction.onTransactionUpdated.add(onTransactionUpdated)
	managers.transaction.connect()
}

export const setSentinel = async () => {
	await chrome.storage.local.set({ [SENTINEL_STORAGE_KEY]: __SENTINEL__ })
	chrome.storage.local.remove("azguard:ui:aztecVersion") // TODO: delete me at some point
}

export const checkProfileSentinel = (profile?: ProfileInfo): boolean => {
	return isCurrentGeneration(profile?.origin)
}
