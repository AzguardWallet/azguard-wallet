import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"
import { WalletConnectServiceClient } from "@/wallet/services/wallet-connect/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()
const walletConnectService = new WalletConnectServiceClient()
const interactionSevice = new InteractionServiceClient()

export const managers = {
	profile: profileService,
	network: networkService,
	wallectConnect: walletConnectService,
	interaction: interactionSevice,
	token: null,
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}

export const initTokenService = ({ profile, network, account }) => {
	managers.token = new TokenServiceClient(profile, network, account)
}
