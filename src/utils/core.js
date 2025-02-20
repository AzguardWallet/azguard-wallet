import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { DappSessionServiceClient } from "@/wallet/services/dapp-session/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { FaucetServiceClient } from "@/wallet/services/faucet/client"
import { PxeServiceClient } from "@/wallet/services/pxe/client"

const profileService = new ProfileServiceClient()
const walletConnectService = new WalletConnectServiceClient()
const dappSessionSevice = new DappSessionServiceClient()
const balanceService = new TokenBalanceServiceClient()
const pxeClientService = new PxeServiceClient()

const faucetService = new FaucetServiceClient()
const executionService = new ExecutionServiceClient(
	null,
	null,
	tx => {
		console.log(tx)
	},
	tx => {
		console.log(tx)
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
	pxe: pxeClientService,
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

export const initTransactionService = onTransactionAdded => {
	if (managers.transaction) managers.transaction.dispose()
	managers.transaction = new TransactionServiceClient(null, null, onTransactionAdded)
}
