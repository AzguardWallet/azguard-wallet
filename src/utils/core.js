import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { TokenServiceClient } from "@/wallet/services/token/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()

export const managers = {
	profile: profileService,
	network: networkService,
	token: null,
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}

export const initTokenService = ({ profile, network, account }) => {
	managers.token = new TokenServiceClient(profile, network, account)
}
