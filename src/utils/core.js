import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()
const walletConnectService = new WalletConnectServiceClient()
const interactionSevice = new InteractionServiceClient()
const balanceService = new TokenBalanceServiceClient()
const transactionService = new TransactionServiceClient()
const executionService = new ExecutionServiceClient(
	null,
	null,
	(tx) => {
		console.log(tx)
	},
	(tx) => {
		console.log(tx)
	}
)

export const managers = {
	profile: profileService,
	network: networkService,
	wallectConnect: walletConnectService,
	interaction: interactionSevice,
	balance: balanceService,
	transaction: transactionService,
	execution: executionService,
	token: null,
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}

export const initTokenService = ({ profile, network, account }) => {
	managers.token = new TokenServiceClient(profile, network, account)
}
