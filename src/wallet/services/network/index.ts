import { createPXEClient } from "@aztec/aztec.js"
import {
	EventMessage,
	RequestMessage,
	ResponseMessage,
} from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { getRandomHex } from "@/wallet/utils"
import {
	AddNetworkRequest,
	AddNetworkResponse,
	DeleteNetworkRequest,
	DeleteNetworkResponse,
	GetNetworkRequest,
	GetNetworkResponse,
	GetNetworksRequest,
	GetNetworksResponse,
	Network,
	NETWORK_SERVICE_NAME,
	NetworkServiceEvent,
	NetworkServiceEventMessage,
	NetworkServiceMethod,
	SetDefaultRequest,
	SetDefaultResponse,
	UpdateNetworkRequest,
	UpdateNetworkResponse,
} from "./client"

type NetworkDto = {
	name: string
	rpcUrl: string
	chainId: number
	protocolVersion: number
	isDefault: boolean
}

export class NetworkService extends Service {
	private readonly networks: EntityStorage<NetworkDto>
	public readonly onDefaultNetworkChanged: ((network: Network) => void)[] = []

	constructor(emit: (event: EventMessage) => void) {
		super(NETWORK_SERVICE_NAME, emit)
		this.networks = new EntityStorage(
			"azguard:core:networks",
			StorageType.Local
		)
	}

	public async process(
		request: RequestMessage
	): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case NetworkServiceMethod.GetNetworks: {
				const _request = request as GetNetworksRequest
				try {
					const networks = await this.getNetworks(_request.chainId)
					return new GetNetworksResponse(_request, networks)
				} catch (error: any) {
					return new GetNetworksResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case NetworkServiceMethod.GetNetwork: {
				const _request = request as GetNetworkRequest
				try {
					const network = await this.getNetwork(_request.networkId)
					return new GetNetworkResponse(_request, network)
				} catch (error: any) {
					return new GetNetworkResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case NetworkServiceMethod.AddNetwork: {
				const _request = request as AddNetworkRequest
				try {
					const network = await this.addNetwork(
						_request.name,
						_request.rpcUrl
					)
					this.emit(
						new NetworkServiceEventMessage(
							NetworkServiceEvent.NetworkAdded,
							network
						)
					)
					return new AddNetworkResponse(_request, network)
				} catch (error: any) {
					return new AddNetworkResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case NetworkServiceMethod.UpdateNetwork: {
				const _request = request as UpdateNetworkRequest
				try {
					const network = await this.updateNetwork(
						_request.networkId,
						_request.name,
						_request.rpcUrl
					)
					this.emit(
						new NetworkServiceEventMessage(
							NetworkServiceEvent.NetworkUpdated,
							network
						)
					)
					return new UpdateNetworkResponse(_request, network)
				} catch (error: any) {
					return new UpdateNetworkResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case NetworkServiceMethod.DeleteNetwork: {
				const _request = request as DeleteNetworkRequest
				try {
					const network = await this.deleteNetwork(_request.networkId)
					this.emit(
						new NetworkServiceEventMessage(
							NetworkServiceEvent.NetworkDeleted,
							network
						)
					)
					return new DeleteNetworkResponse(_request, network)
				} catch (error: any) {
					return new DeleteNetworkResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case NetworkServiceMethod.SetDefault: {
				const _request = request as SetDefaultRequest
				try {
					const network = await this.setDefault(_request.networkId)
					this.emit(
						new NetworkServiceEventMessage(
							NetworkServiceEvent.DefaultNetworkChanged,
							network
						)
					)
					for (const emit of this.onDefaultNetworkChanged) {
						try {
							emit(network)
						} catch {}
					}
					return new SetDefaultResponse(_request, network)
				} catch (error: any) {
					return new SetDefaultResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
	}

	public async getNetworks(chainId?: number): Promise<Array<Network>> {
		const networks = await this.networks.getAll()
		if (chainId) {
			return networks.filter(([_, _network]) => _network.chainId === chainId).map(([id, network]) => this._makeNetwork(id, network))
		}

		if (networks.length === 0) {
			return [
				await this._addNetwork(
					"Sandbox",
					"https://rpc.sandbox.azguardwallet.io",
					31337,
					1,
					true
				),
			]
		}

		return networks.map(([id, network]) => this._makeNetwork(id, network))
	}

	public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
		const [chainId, protocolVersion] = await this._getNodeInfo(rpcUrl)
		return this._addNetwork(name, rpcUrl, chainId, protocolVersion, false)
	}

	public async getNetwork(id: string): Promise<Network> {
		const network = await this.networks.get(id)
		if (!network) {
			throw new Error("unknown network id")
		}
		return this._makeNetwork(id, network)
	}

	public async updateNetwork(
		id: string,
		name: string,
		rpcUrl: string
	): Promise<Network> {
		const network = await this.networks.get(id)
		if (!network) {
			throw new Error("unknown network id")
		}
		const [chainId, protocolVersion] = await this._getNodeInfo(rpcUrl)
		network.isDefault =
			network.chainId === chainId ? network.isDefault : false
		network.name = name
		network.rpcUrl = rpcUrl
		network.chainId = chainId
		network.protocolVersion = protocolVersion
		await this.networks.set(id, network)
		return this._makeNetwork(id, network)
	}

	public async deleteNetwork(id: string): Promise<Network> {
		const network = await this.networks.get(id)
		if (!network) {
			throw new Error("unknown network id")
		}
		await this.networks.delete(id)
		return this._makeNetwork(id, network)
	}

	public async setDefault(id: string): Promise<Network> {
		const network = await this.networks.get(id)
		if (!network) {
			throw new Error("unknown network id")
		}

		const networks = (await this.networks.getAll()).filter(
			([_, _network]) =>
				_network.chainId === network.chainId && _network.isDefault
		)

		for (const [id, _network] of networks) {
			_network.isDefault = false
			await this.networks.set(id, _network)
		}

		network.isDefault = true
		await this.networks.set(id, network)

		return this._makeNetwork(id, network)
	}

	private async _addNetwork(
		name: string,
		rpcUrl: string,
		chainId: number,
		protocolVersion: number,
		isDefault: boolean
	): Promise<Network> {
		let id: string
		do {
			id = getRandomHex(8)
		} while (await this.networks.contains(id))
		const network: NetworkDto = {
			name,
			rpcUrl,
			chainId,
			protocolVersion,
			isDefault,
		}
		await this.networks.set(id, network)
		return this._makeNetwork(id, network)
	}

	private async _getNodeInfo(rpcUrl: string): Promise<[number, number]> {
		try {
			const pxe = createPXEClient(rpcUrl)
			const nodeInfo = await pxe.getNodeInfo()
			return [nodeInfo.l1ChainId, nodeInfo.protocolVersion]
		} catch {
			throw new Error("failed to fetch node info")
		}
	}

	private _makeNetwork(id: string, network: NetworkDto): Network {
		return new Network(
			id,
			network.name,
			network.rpcUrl,
			network.chainId,
			network.protocolVersion,
			network.isDefault
		)
	}
}
