import { type AztecNode, createAztecNodeClient } from "@aztec/stdlib/interfaces/client";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { getErrorMessage } from "@/wallet/utils/errors";
import { Events, Methods, Network, NETWORK_SERVICE_NAME, NodeStatus } from "./spec";

export * from "./spec";

export class NetworkService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = NETWORK_SERVICE_NAME;

    public readonly onNetworkAdded = new EventHandler<Network>();
    public readonly onNetworkUpdated = new EventHandler<Network>();
    public readonly onNetworkDeleted = new EventHandler<Network>();
    public readonly onDefaultNetworkChanged = new EventHandler<Network>();

    private readonly storage = new EntityStorage<Network>("azguard:core:networks", StorageType.Local);
    private readonly nodes = new Map<number, AztecNode>();
    private readonly lock = new Lock();

    private profileService: ProfileService = null!;

    public constructor(logger: ILogger) {
        super(NETWORK_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.profileService.onActiveProfileChanged.add(this.onActiveProfileChanged);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
    }

    public async getOrInitNetworks(): Promise<Network[]> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        try {
            await this.lock.enter();
            const networks = (await this.storage.getValues()).filter(x => x.profileId === profile.id);
            if (networks.length) {
                return networks;
            }

            const defaultNetworks = [];
            // try {
            //     const name = "Azguard Node";
            //     const rpcUrl = "https://node.testnet.azguardwallet.io";
            //     const chainId = 1721521349; // 11155111 ^ 1714840162
            //     defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
            // } catch (error) {
            //     this.logError("Failed to add 'Azguard Node'", getErrorMessage(error));
            // }
            // try {
            //     const name = "Aztec Node";
            //     const rpcUrl = "https://aztec-alpha-testnet-fullnode.zkv.xyz";
            //     const chainId = 1721521349; // 11155111 ^ 1714840162
            //     defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, false));
            // } catch (error) {
            //     this.logError("Failed to add 'Aztec Node'", getErrorMessage(error));
            // }
            // try {
            //     const name = "Azguard Node";
            //     const rpcUrl = "https://node.devnet.azguardwallet.io";
            //     const chainId = 1654394782; // 11155111 ^ 1667575857
            //     defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
            // } catch (error) {
            //     this.logError("Failed to add 'Azguard Node'", getErrorMessage(error));
            // }
            try {
                const name = "Aztec Node";
                const rpcUrl = "https://next.devnet.aztec-labs.com";
                const chainId = 1654394782; // 11155111 ^ 1667575857
                defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
            } catch (error) {
                this.logError("Failed to add 'Aztec Node'", getErrorMessage(error));
            }
            try {
                const name = "Sandbox";
                const rpcUrl = "http://localhost:8080";
                const chainId = 0;
                defaultNetworks.push(await this._addNetwork(profile.id, name, rpcUrl, chainId, true));
            } catch (error) {
                this.logError("Failed to add 'Sandbox'", getErrorMessage(error));
            }
            for (const network of defaultNetworks.filter(x => x.isDefault)) {
                this.emit("onDefaultNetworkChanged", network);
                this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl));
            }
            return defaultNetworks;
        } finally {
            this.lock.leave();
        }
    }

    public async getNetworks(chainId?: number): Promise<Network[]> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        return (await this.storage.getValues()).filter(
            x => x.profileId === profile.id && (chainId === undefined || x.chainId === chainId),
        );
    }

    public async getNetwork(id: string): Promise<Network> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const network = await this.storage.get(id);
        if (network?.profileId !== profile.id) {
            throw new Error("Invalid id");
        }
        return network;
    }

    public async addNetwork(name: string, rpcUrl: string): Promise<Network> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const chainId = await this.getChainId(rpcUrl);
        try {
            await this.lock.enter();
            const network = await this._addNetwork(profile.id, name, rpcUrl, chainId, false);
            this.emit("onNetworkAdded", network);
            return network;
        } finally {
            this.lock.leave();
        }
    }

    public async updateNetwork(id: string, name: string, rpcUrl: string): Promise<Network> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
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
            this.emit("onNetworkUpdated", network);
            return network;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteNetwork(id: string): Promise<Network> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
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
            this.emit("onNetworkDeleted", network);
            return network;
        } finally {
            this.lock.leave();
        }
    }

    public async setDefault(id: string): Promise<Network> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
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
                    _network.isDefault,
            );
            for (const [id, _network] of networks) {
                _network.isDefault = false;
                await this.storage.set(id, _network);
            }
            network.isDefault = true;
            await this.storage.set(id, network);
            this.nodes.set(network.chainId, createAztecNodeClient(network.rpcUrl));
            this.emit("onDefaultNetworkChanged", network);
            return network;
        } finally {
            this.lock.leave();
        }
    }

    public async getNodeStatus(id: string): Promise<NodeStatus> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
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
        } catch {
            return NodeStatus.Inactive;
        }
    }

    public async getNode(chainId: number): Promise<AztecNode> {
        await this.ensureInitialized();
        try {
            await this.lock.enter();
            let node = this.nodes.get(chainId);
            if (!node) {
                const profile = await this.profileService.getActiveProfile();
                if (!profile) {
                    throw new Error("Profile locked");
                }
                const networks = (await this.storage.getValues()).filter(
                    x => x.profileId === profile.id && x.chainId === chainId,
                );
                const network = networks.find(x => x.isDefault) ?? networks[0];
                node = createAztecNodeClient(network.rpcUrl);
                this.nodes.set(chainId, node);
            }
            return node;
        } finally {
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
        const network: Network = {
            id,
            profileId,
            name,
            rpcUrl,
            chainId,
            isDefault,
        };
        await this.storage.set(network.id, network);
        return network;
    }

    private async getChainId(rpcUrl: string): Promise<number> {
        try {
            const rpc = createAztecNodeClient(rpcUrl);
            const info = await rpc.getNodeInfo();
            if (rpcUrl === "http://localhost:8080") {
                return 0;
            }
            return info.l1ChainId ^ info.rollupVersion;
        } catch (error) {
            this.logError("Failed to fetch node info", getErrorMessage(error));
            throw new Error("Failed to fetch node info");
        }
    }

    private readonly onActiveProfileChanged = async () => {
        try {
            await this.lock.enter();
            this.nodes.clear();
        } finally {
            this.lock.leave();
        }
    };

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`Profile ${profile.id} deleted, remove related networks`);
        try {
            await this.lock.enter();
            this.nodes.clear();
            const networks = (await this.storage.getValues()).filter(x => x.profileId === profile.id);
            for (const network of networks) {
                this.logDebug(`Remove network #${network.id}`);
                await this.storage.delete(network.id);
                this.emit("onNetworkDeleted", network);
            }
        } finally {
            this.lock.leave();
        }
    };

    public async backup(): Promise<Network[]> {
        return (await this.getNetworks());
    }

    public async restore(networks: Network[]): Promise<Restored<Network>[]> {
        await this.ensureInitialized();

        const result: Restored<Network>[] = [];
        try {
            await this.lock.enter();

            for (const n of networks) {
                try {
                    let id = n.id;
                    while ((await this.storage.contains(id))) {
                        id = getRandomHex(8);
                    }

                    await this.storage.set(id, { ...n, id });
                    result.push({ ...n, id });
                } catch (err) {
                    result.push({
                        ...n,
                        restoreError: err instanceof Error ? err.message : err,
                    });
                }
            }

            return result;
        } finally {
            this.lock.leave();
        }
    }
}
