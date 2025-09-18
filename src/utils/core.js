import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { FaucetServiceClient } from "@/wallet/services/faucet/client"
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
const walletConnectService = new WalletConnectServiceClient()
walletConnectService.connect()
const dappSessionSevice = new DappSessionServiceClient()
dappSessionSevice.connect()
const balanceService = new TokenBalanceServiceClient()
balanceService.connect()

const faucetService = new FaucetServiceClient()
faucetService.connect()
const executionService = new ExecutionServiceClient()
executionService.connect()
const contactService = new ContactServiceClient()
contactService.connect()

export const managers = {
	profile: profileService,
	network: null, // must be initialized after profile.onActiveProfileChanged
	wallectConnect: walletConnectService,
	dappSession: dappSessionSevice,
	balance: balanceService,
	execution: executionService,
	faucet: faucetService,
	transaction: null,
	token: null,
	contact: contactService,
}

export const initTokenService = ({ profile, network, account, onTokenAdded, onTokenUpdated, onTokenDeleted }) => {
	try {
		if (managers.token) managers.token.disconnect()
		managers.token = new TokenServiceClient()
		managers.token.onTokenAdded.add(onTokenAdded)
		managers.token.onTokenDeleted.add(onTokenDeleted)
		managers.token.onTokenUpdated.add(onTokenUpdated)
		managers.token.connect()
	} catch (error) {
		console.error(error)
	}
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
