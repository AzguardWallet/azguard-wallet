import { type AztecNode, createAztecNodeClient } from "@aztec/stdlib/interfaces/client"
import { makeFetchWithTimeout } from "@/wallet/utils/fetch"
import type { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import type { ILogger } from "@/wallet/logger"
import { ProfileService, type ProfileInfo } from "@/wallet/services/profile/service"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { getRandomHex, Lock } from "@/wallet/utils"
import { EventHandler } from "@/wallet/utils/event-handler"
import { getErrorMessage } from "@/wallet/utils/errors"
import { type Events, type Methods, type Network, NETWORK_SERVICE_NAME, NodeStatus } from "./spec"

export * from "./spec"

export class NetworkService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
	public static name = NETWORK_SERVICE_NAME

	public readonly onNetworkAdded = new EventHandler<Network>()
	public readonly onNetworkUpdated = new EventHandler<Network>()
	public readonly onNetworkDeleted = new EventHandler<Network>()
	public readonly onDefaultNetworkChanged = new EventHandler<Network>()

	private readonly storage = new EntityStorage<Network>("nulo:core:networks", StorageType.Local)
	private readonly nodes = new Map<number, AztecNode>()
	private readonly lock: Lock

	private profileService: ProfileService = null!

	public constructor(logger: ILogger) {
		super(NETWORK_SERVICE_NAME, logger)
		this.lock = new Lock("network", logger)
	}

	protected async init(services: ServiceCollection) {
		this.profileService = services.get(ProfileService.name)
		this.profileService.onActiveProfileChanged.add(this.onActiveProfileChanged)
		this.profileService.onProfileDeleted.add(this.onProfileDeleted)
	}

	public async getOrInitNetworks(): Promise<Network[]> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		try {
			await this.lock.enter()
			const networks = (await this.storage.getValues()).filter((x) => x.profileId === profile.id)
			if (networks.length) {
				return networks
			}

			const defaultNetworks = []
			try {
				const name = "Alpha Mainnet"
				const rpcUrl = "https://aztec-mainnet.drpc.org"
				const chainId = 2934756904 // (1 ^ 2934756905) >>> 0
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, false))
			} catch (error) {
				this.logError("Failed to add 'Alpha Mainnet'", getErrorMessage(error))
			}
			try {
				const name = "Testnet"
				const rpcUrl = "https://rpc.testnet.aztec-labs.com"
				const chainId = 4138294185 // (11155111 ^ 4127419662) >>> 0
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true))
			} catch (error) {
				this.logError("Failed to add 'Testnet'", getErrorMessage(error))
			}
			try {
				const name = "Devnet"
				const rpcUrl = "https://v4-devnet-3.aztec-labs.com/"
				const chainId = 896946031 // (11155111 ^ 903641544) >>> 0
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, false))
			} catch (error) {
				this.logError("Failed to add 'Devnet'", getErrorMessage(error))
			}
			try {
				const name = "Local Network"
				const rpcUrl = "http://localhost:8080"
				const chainId = 0
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, false))
			} catch (error) {
				this.logError("Failed to add 'Local Network'", getErrorMessage(error))
			}
			for (const network of defaultNetworks.filter((x) => x.isDefault)) {
				this.emit("onDefaultNetworkChanged", network)
				this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl, {}, makeFetchWithTimeout()))
			}
			return defaultNetworks
		} finally {
			this.lock.leave()
		}
	}

	public async getNetworks(chainId?: number): Promise<Network[]> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		return (await this.storage.getValues()).filter(
			(x) => x.profileId === profile.id && (chainId === undefined || x.chainId === chainId),
		)
	}

	public async getNetwork(id: string): Promise<Network> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		const network = await this.storage.get(id)
		if (network?.profileId !== profile.id) {
			throw new Error("Invalid id")
		}
		return network
	}

	public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		const chainId = await this.getChainId(rpcUrl)
		try {
			await this.lock.enter()
			const network = await this._addNetwork(profile.id, name, rpcUrl, chainId, false)
			this.emit("onNetworkAdded", network)
			return network
		} finally {
			this.lock.leave()
		}
	}

	public async updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		const chainId = await this.getChainId(rpcUrl)
		try {
			await this.lock.enter()
			const network = await this.storage.get(id)
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id")
			}
			network.isDefault = network.chainId === chainId ? network.isDefault : false
			network.name = name
			network.rpcUrl = rpcUrl
			network.chainId = chainId
			await this.storage.set(id, network)
			this.emit("onNetworkUpdated", network)
			return network
		} finally {
			this.lock.leave()
		}
	}

	public async deleteNetwork(id: string): Promise<Network> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		try {
			await this.lock.enter()
			const network = await this.storage.get(id)
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id")
			}
			await this.storage.delete(id)
			this.emit("onNetworkDeleted", network)
			return network
		} finally {
			this.lock.leave()
		}
	}

	public async setDefault(id: string): Promise<Network> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		try {
			await this.lock.enter()
			const network = await this.storage.get(id)
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id")
			}
			const networks = (await this.storage.getAll()).filter(
				([_, _network]) => _network.profileId === network.profileId && _network.chainId === network.chainId && _network.isDefault,
			)
			for (const [id, _network] of networks) {
				_network.isDefault = false
				await this.storage.set(id, _network)
			}
			network.isDefault = true
			await this.storage.set(id, network)
			this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl, {}, makeFetchWithTimeout()))
			this.emit("onDefaultNetworkChanged", network)
			return network
		} finally {
			this.lock.leave()
		}
	}

	public async getNodeStatus(id: string): Promise<NodeStatus> {
		await this.ensureInitialized()
		const profile = await this.profileService.getActiveProfile()
		if (!profile) {
			throw new Error("Profile locked")
		}
		const network = await this.storage.get(id)
		if (network?.profileId !== profile.id) {
			throw new Error("Invalid id")
		}
		try {
			const chainId = await this.getChainId(network.rpcUrl)
			if (chainId !== network.chainId) {
				return NodeStatus.InvalidChain
			}
			return NodeStatus.Active
		} catch {
			return NodeStatus.Inactive
		}
	}

	public async getNode(chainId: number): Promise<AztecNode> {
		await this.ensureInitialized()
		try {
			await this.lock.enter()
			let node = this.nodes.get(chainId)
			if (!node) {
				const profile = await this.profileService.getActiveProfile()
				if (!profile) {
					throw new Error("Profile locked")
				}
				const networks = (await this.storage.getValues()).filter((x) => x.profileId === profile.id && x.chainId === chainId)
				const network = networks.find((x) => x.isDefault) ?? networks[0]
				node = createAztecNodeClient(network.rpcUrl, {}, makeFetchWithTimeout())
				this.nodes.set(chainId, node)
			}
			return node
		} finally {
			this.lock.leave()
		}
	}

	private async _addNetwork(profileId: string, name: string, rpcUrl: string, chainId: number, isDefault: boolean): Promise<Network> {
		let id: string
		do {
			id = getRandomHex(8)
		} while (await this.storage.contains(id))
		const network: Network = {
			id,
			profileId,
			name,
			rpcUrl,
			chainId,
			isDefault,
		}
		await this.storage.set(network.id, network)
		return network
	}

	private async getChainId(rpcUrl: string): Promise<number> {
		try {
			const rpc = createAztecNodeClient(rpcUrl, {}, makeFetchWithTimeout())
			const info = await rpc.getNodeInfo()
			if (rpcUrl === "http://localhost:8080") {
				return 0
			}
			return (info.l1ChainId ^ info.rollupVersion) >>> 0
		} catch (error) {
			this.logError("Failed to fetch node info", getErrorMessage(error))
			throw new Error("Failed to fetch node info")
		}
	}

	private readonly onActiveProfileChanged = async () => {
		try {
			await this.lock.enter()
			this.nodes.clear()
		} finally {
			this.lock.leave()
		}
	}

	private readonly onProfileDeleted = async (profile: ProfileInfo) => {
		this.logDebug(`Profile ${profile.id} deleted, remove related networks`)
		try {
			await this.lock.enter()
			this.nodes.clear()
			const networks = (await this.storage.getValues()).filter((x) => x.profileId === profile.id)
			for (const network of networks) {
				this.logDebug(`Remove network #${network.id}`)
				await this.storage.delete(network.id)
				this.emit("onNetworkDeleted", network)
			}
		} finally {
			this.lock.leave()
		}
	}

	public async backup(): Promise<Network[]> {
		return await this.getNetworks()
	}

	public async restore(networks: Network[]): Promise<Restored<Network>[]> {
		await this.ensureInitialized()

		const result: Restored<Network>[] = []
		try {
			await this.lock.enter()

			for (const n of networks) {
				try {
					let id = n.id
					while (await this.storage.contains(id)) {
						id = getRandomHex(8)
					}

					await this.storage.set(id, { ...n, id })
					result.push({ ...n, id })
				} catch (err) {
					result.push({
						...n,
						restoreError: err instanceof Error ? err.message : err,
					})
				}
			}

			return result
		} finally {
			this.lock.leave()
		}
	}
}
