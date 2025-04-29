import { AztecNode, createAztecNodeClient } from "@aztec/stdlib/interfaces/client";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { ProfileService } from "@/wallet/services/profile";
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
	GetOrInitNetworksRequest,
	GetOrInitNetworksResponse,
} from "./client";

type NetworkDto = {
	profileId: string,
	name: string;
	rpcUrl: string;
	chainId: number;
	isDefault: boolean;
};

export class NetworkService extends Service {
	public readonly onDefaultNetworkChanged: ((network: Network) => void)[] = [];

	private readonly storage: EntityStorage<NetworkDto>;
	private readonly lock = new Lock();
	private readonly nodes = new Map<number, AztecNode>();

	constructor(
		private readonly profiles: ProfileService,
		emit: (event: EventMessage) => void
	) {
		super(NETWORK_SERVICE_NAME, emit);
		this.storage = new EntityStorage("azguard:core:networks", StorageType.Local);
		this.profiles.onActiveProfileChanged.push(this.onActiveProfileChanged);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
	}

	public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case NetworkServiceMethod.GetOrInitNetworks: {
				const _request = request as GetOrInitNetworksRequest;
				try {
					const networks = await this.getOrInitNetworks()
					return new GetOrInitNetworksResponse(_request, networks)
				} catch (error: any) {
					return new GetOrInitNetworksResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.GetNetworks: {
				const _request = request as GetNetworksRequest;
				try {
					const networks = await this.getNetworks(_request.chainId)
					return new GetNetworksResponse(_request, networks)
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
			case NetworkServiceMethod.GetNodeStatus: {
				const _request = request as GetNodeStatusRequest;
				try {
					const status = await this.getNodeStatus(_request.networkId);
					return new GetNodeStatusResponse(_request, status);
				} catch (error: any) {
					return new GetNodeStatusResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.AddNetwork: {
				const _request = request as AddNetworkRequest;
				try {
					const network = await this.addNetwork(_request.name, _request.rpcUrl);
					return new AddNetworkResponse(_request, network);
				} catch (error: any) {
					return new AddNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.UpdateNetwork: {
				const _request = request as UpdateNetworkRequest;
				try {
					const network = await this.updateNetwork(_request.networkId, _request.name, _request.rpcUrl);
					return new UpdateNetworkResponse(_request, network);
				} catch (error: any) {
					return new UpdateNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.DeleteNetwork: {
				const _request = request as DeleteNetworkRequest;
				try {
					const network = await this.deleteNetwork(_request.networkId);
					return new DeleteNetworkResponse(_request, network);
				} catch (error: any) {
					return new DeleteNetworkResponse(_request, undefined, error.message);
				}
			}
			case NetworkServiceMethod.SetDefault: {
				const _request = request as SetDefaultRequest;
				try {
					const network = await this.setDefault(_request.networkId);
					return new SetDefaultResponse(_request, network);
				} catch (error: any) {
					return new SetDefaultResponse(_request, undefined, error.message);
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`);
				return undefined;
			}
		}
	}

	public async getOrInitNetworks(): Promise<Array<Network>> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		try {
			await this.lock.enter();
			const networks = (await this.storage.getAll()).filter(([_, v]) => v.profileId === profile.id);
			if (networks.length) {
				return networks.map(([id, network]) => this.makeNetwork(id, network));
			}
			
			let defaultNetworks = [];
			try {
				const name = "Testnet";
				const rpcUrl = "http://34.107.66.170";
				const chainId = 11155111;
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
			}
			catch (error) {
				console.error("Failed to add 'Testnet'", error);
			}
			try {
				const name = "Devnet";
				const rpcUrl = "http://34.169.170.55:8080";
				const chainId = 1337;
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
			}
			catch (error) {
				console.error("Failed to add 'Devnet'", error);
			}
			try {
				const name = "Sandbox";
				const rpcUrl = "http://localhost:8080";
				const chainId = 31337;
				defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
			}
			catch (error) {
				console.error("Failed to add 'Local Sandbox'", error);
			}
			for (const network of defaultNetworks) {
				this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.DefaultNetworkChanged, network));
				for (const emit of this.onDefaultNetworkChanged) {
					try {emit(network)} catch {}
				}
				this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl));
			}
			return defaultNetworks;
		} finally {
			this.lock.leave();
		}
	}

	public async getNetworks(chainId?: number): Promise<Array<Network>> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		return (await this.storage.getAll())
			.filter(([_, network]) => 
				network.profileId === profile.id && (chainId === undefined || network.chainId === chainId)
			)
			.map(([id, network]) =>
				this.makeNetwork(id, network)
			);
	}

	public async getNetwork(id: string): Promise<Network> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		const network = await this.storage.get(id);
		if (network?.profileId !== profile.id) {
			throw new Error("Invalid id");
		}
		return this.makeNetwork(id, network);
	}

	public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		const chainId = await this.getChainId(rpcUrl);
		try {
			await this.lock.enter();
			const network = await this._addNetwork(profile.id, name, rpcUrl, chainId, false);
			this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkAdded, network));
			return network;
		} finally {
			this.lock.leave();
		}
	}

	public async updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		const chainId = await this.getChainId(rpcUrl);
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id");
			}
			network.isDefault = network.chainId === chainId ? network.isDefault : false;
			network.name = name;
			network.rpcUrl = rpcUrl;
			network.chainId = chainId;
			await this.storage.set(id, network);
			const res = this.makeNetwork(id, network);
			this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkUpdated, res));
			return res;
		} finally {
			this.lock.leave();
		}
	}

	public async deleteNetwork(id: string): Promise<Network> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id");
			}
			await this.storage.delete(id);
			const res = this.makeNetwork(id, network);
			this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkDeleted, res));
			return res;
		} finally {
			this.lock.leave();
		}
	}

	public async setDefault(id: string): Promise<Network> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		try {
			await this.lock.enter();
			const network = await this.storage.get(id);
			if (network?.profileId !== profile.id) {
				throw new Error("Invalid id");
			}
			const networks = (await this.storage.getAll()).filter(
				([_, _network]) =>
					_network.profileId === network.profileId &&
					_network.chainId === network.chainId &&
					_network.isDefault
			);
			for (const [id, _network] of networks) {
				_network.isDefault = false;
				await this.storage.set(id, _network);
			}
			network.isDefault = true;
			await this.storage.set(id, network);
			const res = this.makeNetwork(id, network);
			this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.DefaultNetworkChanged, res));
			for (const emit of this.onDefaultNetworkChanged) {
				try {emit(res)} catch {}
			}
			this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl));
			return res;
		} finally {
			this.lock.leave();
		}
	}

	public async getNodeStatus(id: string): Promise<NodeStatus> {
		const profile = await this.profiles.getActiveProfile();
		if (!profile) {
			throw new Error("Profile locked");
		}
		const network = await this.storage.get(id);
		if (network?.profileId !== profile.id) {
			throw new Error("Invalid id");
		}
		try {
			const chainId = await this.getChainId(network.rpcUrl);
			if (chainId !== network.chainId) {
				return NodeStatus.InvalidChain;
			}
			return NodeStatus.Active;
		}
		catch {
			return NodeStatus.Inactive;
		}
	}

	public async getNode(chainId: number): Promise<AztecNode> {
        try {
            await this.lock.enter();
            let node = this.nodes.get(chainId);
            if (!node) {
				const profile = await this.profiles.getActiveProfile();
				if (!profile) {
					throw new Error("Profile locked");
				}
                const networks = (await this.storage.getValues()).filter(x => x.profileId === profile.id && x.chainId === chainId);
                const network = networks.find(x => x.isDefault) ?? networks[0];
                node = createAztecNodeClient(network.rpcUrl);
                this.nodes.set(chainId, node);
            }
            return node;
        }
        finally {
            this.lock.leave();
        }
	}

	private async _addNetwork(
		profileId: string,
		name: string,
		rpcUrl: string,
		chainId: number,
		isDefault: boolean,
	): Promise<Network> {
		let id: string;
		do {
			id = getRandomHex(8);
		} while (await this.storage.contains(id));
		const network: NetworkDto = {
			profileId,
			name,
			rpcUrl,
			chainId,
			isDefault,
		};
		await this.storage.set(id, network);
		return this.makeNetwork(id, network);
	}

	private async getChainId(rpcUrl: string): Promise<number> {
		try {
			const rpc = createAztecNodeClient(rpcUrl);
			return (await rpc.getNodeInfo()).l1ChainId;
		} catch (error) {
			console.error(error);
			throw new Error("Failed to fetch node info");
		}
	}

	private makeNetwork(id: string, network: NetworkDto): Network {
		return new Network(
			id,
			network.profileId,
			network.name,
			network.rpcUrl,
			network.chainId,
			network.isDefault,
		);
	}
    
    private readonly onActiveProfileChanged = async () => {
        try {
            await this.lock.enter();
            this.nodes.clear();
        }
        finally {
            this.lock.leave();
        }
    };

    private readonly onProfileDeleted = async (profileId: string) => {
        console.debug(`profile ${profileId} deleted, remove related networks`);
        try {
			await this.lock.enter();
            this.nodes.clear();
			const networks = (await this.storage.getAll()).filter(([_, network]) => network.profileId === profileId);
			for (const [id, network] of networks) {
				console.debug(`remove network #${id}`);
				await this.storage.delete(id);
				this.emit(new NetworkServiceEventMessage(NetworkServiceEvent.NetworkDeleted, this.makeNetwork(id, network)));
			}
		} finally {
			this.lock.leave();
		}
    }
}
