import { createPXEClient } from "@aztec/aztec.js";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
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
	GetNodeStatusRequest,
	GetNodeStatusResponse,
	SetDefaultRequest,
	SetDefaultResponse,
	UpdateNetworkRequest,
	UpdateNetworkResponse,
	NodeStatus,
} from "./client";

type NetworkDto = {
	name: string;
	rpcUrl: string;
	chainId: number;
	protocolVersion: number;
	isDefault: boolean;
};

export class NetworkService extends Service {
	public readonly onDefaultNetworkChanged: ((network: Network) => void)[] = [];

	private readonly storage: EntityStorage<NetworkDto>;
	private readonly lock = new Lock();

	constructor(emit: (event: EventMessage) => void) {
		super(NETWORK_SERVICE_NAME, emit);
		this.storage = new EntityStorage("azguard:core:networks", StorageType.Local);
	}

	public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case NetworkServiceMethod.GetNetworks: {
				const _request = request as GetNetworksRequest;
				try {
					const networks = await this.getNetworks();
					return new GetNetworksResponse(_request, networks);
				} catch (error: any) {
					return new GetNetworksResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.GetNetwork: {
				const _request = request as GetNetworkRequest;
				try {
					const network = await this.getNetwork(_request.networkId);
					return new GetNetworkResponse(_request, network);
				} catch (error: any) {
					return new GetNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.AddNetwork: {
				const _request = request as AddNetworkRequest;
				try {
					const network = await this.addNetwork(_request.name, _request.rpcUrl);
					this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkAdded, network));
					return new AddNetworkResponse(_request, network);
				} catch (error: any) {
					return new AddNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.UpdateNetwork: {
				const _request = request as UpdateNetworkRequest;
				try {
					const network = await this.updateNetwork(_request.networkId, _request.name, _request.rpcUrl);
					this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkUpdated, network));
					return new UpdateNetworkResponse(_request, network);
				} catch (error: any) {
					return new UpdateNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.DeleteNetwork: {
				const _request = request as DeleteNetworkRequest;
				try {
					const network = await this.deleteNetwork(_request.networkId);
					this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkDeleted, network));
					return new DeleteNetworkResponse(_request, network);
				} catch (error: any) {
					return new DeleteNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.SetDefault: {
				const _request = request as SetDefaultRequest;
				try {
					const network = await this.setDefault(_request.networkId);
					this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.DefaultNetworkChanged, network));
					for (const emit of this.onDefaultNetworkChanged) {
						try {
							emit(network);
						} catch {}
					}
					return new SetDefaultResponse(_request, network);
				} catch (error: any) {
					return new SetDefaultResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.GetNodeStatus: {
				const _request = request as GetNodeStatusRequest;
				try {
					const status = await this.getNodeStatus(_request.networkId);
					return new GetNodeStatusResponse(_request, status);
				} catch (error: any) {
					return new GetNodeStatusResponse(_request, undefined, error.message);
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`);
				return undefined;
			}
		}
	}

	public async getNetworks(): Promise<Array<Network>> {
		const networks = await this.storage.getAll();
		if (networks.length) {
			return networks.map(([id, network]) => this.makeNetwork(id, network));
		}
		return this.seedNetworks();
	}

	public async getNetwork(id: string): Promise<Network> {
		const network = await this.storage.get(id);
		if (!network) {
			throw new Error("unknown network id");
		}
		return this.makeNetwork(id, network);
	}

	public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
		const [chainId, protocolVersion] = await this.getNodeInfo(rpcUrl);
		try {
			await this.lock.enter();
			return this._addNetwork(name, rpcUrl, chainId, protocolVersion, false);
		} finally {
			this.lock.leave();
		}
	}

	public async updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
		const [chainId, protocolVersion] = await this.getNodeInfo(rpcUrl);
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (!network) {
				throw new Error("unknown network id");
			}
			network.isDefault = network.chainId === chainId ? network.isDefault : false;
			network.name = name;
			network.rpcUrl = rpcUrl;
			network.chainId = chainId;
			network.protocolVersion = protocolVersion;
			await this.storage.set(id, network);
			return this.makeNetwork(id, network);
		} finally {
			this.lock.leave();
		}
	}

	public async deleteNetwork(id: string): Promise<Network> {
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (!network) {
				throw new Error("unknown network id");
			}
			await this.storage.delete(id);
			return this.makeNetwork(id, network);
		} finally {
			this.lock.leave();
		}
	}

	public async setDefault(id: string): Promise<Network> {
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (!network) {
				throw new Error("unknown network id");
			}
			const networks = (await this.storage.getAll()).filter(
				([_, _network]) => _network.chainId === network.chainId && _network.isDefault,
			);
			for (const [id, _network] of networks) {
				_network.isDefault = false;
				await this.storage.set(id, _network);
			}
			network.isDefault = true;
			await this.storage.set(id, network);
			return this.makeNetwork(id, network);
		} finally {
			this.lock.leave();
		}
	}

	public async getNodeStatus(id: string): Promise<NodeStatus> {
		const network = await this.storage.get(id);
		if (!network) {
			throw new Error("unknown network id");
		}
		try {
			const [chainId, protocolVersion] = await this.getNodeInfo(network.rpcUrl);
			if (chainId !== network.chainId || protocolVersion !== network.protocolVersion) {
				return NodeStatus.InvalidChain;
			}
			return NodeStatus.Active;
		}
		catch {
			return NodeStatus.Inactive;
		}
	}

	private async seedNetworks(): Promise<Array<Network>> {
		try {
			await this.lock.enter();
			const networks = await this.storage.getAll();
			if (networks.length) {
				return networks.map(([id, network]) => this.makeNetwork(id, network));
			}
			return [
				await this._addNetwork("Shared PXE", "https://rpc.sandbox.azguardwallet.io", 41337, 1, true),
				await this._addNetwork("Local PXE", "http://localhost:8080", 31337, 1, false),
			];
		} finally {
			this.lock.leave();
		}
	}

	private async _addNetwork(
		name: string,
		rpcUrl: string,
		chainId: number,
		protocolVersion: number,
		isDefault: boolean,
	): Promise<Network> {
		let id: string;
		do {
			id = getRandomHex(8);
		} while (await this.storage.contains(id));
		const network: NetworkDto = {
			name,
			rpcUrl,
			chainId,
			protocolVersion,
			isDefault,
		};
		await this.storage.set(id, network);
		return this.makeNetwork(id, network);
	}

	private async getNodeInfo(rpcUrl: string): Promise<[number, number]> {
		try {
			const pxe = createPXEClient(rpcUrl);
			const nodeInfo = await pxe.getNodeInfo();
			return [nodeInfo.l1ChainId, nodeInfo.protocolVersion];
		} catch {
			throw new Error("failed to fetch node info");
		}
	}

	private makeNetwork(id: string, network: NetworkDto): Network {
		return new Network(
			id,
			network.name,
			network.rpcUrl,
			network.chainId,
			network.protocolVersion,
			network.isDefault,
		);
	}
}
