import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { FaucetServiceClient } from "@/wallet/services/faucet/client"
import { AccountStateServiceClient } from "@/wallet/services/account-state/client"

const profileService = new ProfileServiceClient()
const walletConnectService = new WalletConnectServiceClient()
const dappSessionSevice = new DappSessionServiceClient()
const balanceService = new TokenBalanceServiceClient()
const accountStateClientService = new AccountStateServiceClient()

const faucetService = new FaucetServiceClient()
const executionService = new ExecutionServiceClient(
	null,
	null,
	tx => {
		// console.log(tx)
	},
	tx => {
		// console.log(tx)
	},
)

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
	accountState: accountStateClientService,
}

export const initTokenService = ({ profile, network, account, onTokenAdded, onTokenUpdated, onTokenDeleted }) => {
	try {
		if (managers.token) managers.token.dispose()
		managers.token = new TokenServiceClient(
			profile,
			network,
			account,
			null,
			null,
			onTokenAdded,
			onTokenUpdated,
			onTokenDeleted,
		)
	} catch (error) {
		console.error(error)
	}
}

export const initTransactionService = (onTransactionAdded, onTransactionUpdated) => {
	if (managers.transaction) managers.transaction.dispose()
	managers.transaction = new TransactionServiceClient(null, null, onTransactionAdded, onTransactionUpdated)
}

export const setAztecVersion = async (version) => {
	if (version) {
		chrome.storage.local.set({ "azguard:ui:aztecVersion": version })
	} else {
		chrome.storage.local.set({ "azguard:ui:aztecVersion": __AZTEC_VERSION__ })
	}
}

export const checkAztecVersion = async () => {
	const currentVersion = (await chrome.storage.local.get("azguard:ui:aztecVersion"))["azguard:ui:aztecVersion"] || ""

	if (!currentVersion) {
		return false
	}

	switch (currentVersion) {
		case "0.85.0":
			return false
		default:
			return true
	}
}
