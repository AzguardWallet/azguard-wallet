import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { TokenServiceClient } from "@/wallet/services/token/client"
import { TokenBalanceServiceClient } from "@/wallet/services/token-balance/client"
import { ExecutionServiceClient } from "@/wallet/services/execution/client"
import { TransactionServiceClient } from "@/wallet/services/transaction/client"
import { FaucetServiceClient } from "@/wallet/services/faucet/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()
const balanceService = new TokenBalanceServiceClient()

const faucetService = new FaucetServiceClient()
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
	balance: balanceService,
	execution: executionService,
	faucet: faucetService,
	transaction: null,
	token: null,
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}

export const initTokenService = ({ profile, network, account }) => {
	managers.token = new TokenServiceClient(profile, network, account)
}

export const initTransactionService = (onTransactionAdded) => {
	managers.transaction = new TransactionServiceClient(
		null,
		null,
		onTransactionAdded
	)
}
