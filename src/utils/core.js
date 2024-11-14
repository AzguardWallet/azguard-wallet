
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()

export const managers = {
	profile: profileService,
	network: networkService
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}