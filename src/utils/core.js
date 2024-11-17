
import { ProfileServiceClient } from "@/wallet/services/profile/client"
import { NetworkServiceClient } from "@/wallet/services/network/client"
import { InteractionServiceClient } from "@/wallet/services/interaction/client"

const profileService = new ProfileServiceClient()
const networkService = new NetworkServiceClient()
// const interactionSevice = new InteractionServiceClient()

export const managers = {
	profile: profileService,
	network: networkService,
	// interaction: interactionSevice,
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}