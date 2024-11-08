
import { ProfileManager } from "@/wallet/profiles"
import { NetworkManager } from "@/wallet/networks"

const profileManager = new ProfileManager()
const networkManager = new NetworkManager()

export const managers = {
	profile: profileManager,
	network: networkManager
}

export const initNetworks = async () => {
	return await managers.network.getNetworks()
}