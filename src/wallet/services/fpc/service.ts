import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { NetworkService } from "@/wallet/services/network/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Fpc } from "./fpc";
import { getFpcHandler } from "./handlers";
import { Events, FPC_SERVICE_NAME, FpcInfo, FpcType, Methods } from "./spec";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { loadContractArtifact } from "@aztec/stdlib/abi";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
// @ts-ignore — raw JSON import via vite alias, bypasses @aztec/aztec.js (which references document/window)
import BridgedFPCJson from "@bridged-fpc-artifact";
import { Fr } from "@aztec/foundation/curves/bn254";

const BridgedFPCContractArtifact = loadContractArtifact(BridgedFPCJson);

export * from "./fpc";
export * from "./spec";

export class FpcService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = FPC_SERVICE_NAME;

    public readonly onFpcAdded = new EventHandler<FpcInfo>();
    public readonly onFpcUpdated = new EventHandler<FpcInfo>();
    public readonly onFpcDeleted = new EventHandler<FpcInfo>();

    private readonly storage = new EntityStorage<FpcInfo>("azguard:core:fpcs", StorageType.Local);
    private readonly lock = new Lock();

    private pxeService: PxeServiceClient = null!;
    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;

    public constructor(logger: ILogger) {
        super(FPC_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
    }

    public async getFpcs(chainId?: number): Promise<FpcInfo[]> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const result = (await this.storage.getValues()).filter(
            fpc => fpc.profileId === profile.id && (chainId === undefined || fpc.chainId === chainId),
        );
        // Auto-discover missing protocol FPCs (SponsoredFPC, BridgedFPC)
        if (chainId !== undefined) {
            const hasSponsoredFpc = result.some(f => f.type === FpcType.DefaultSponsoredFpc);
            const hasBridgedFpc = result.some(f => f.type === FpcType.BridgedFpc);

            if (!hasSponsoredFpc || !hasBridgedFpc) {
                this.logInfo("Discovering missing protocol FPCs...");
                try {
                    await this.lock.enter();
                    const networks = await this.networkService.getNetworks(chainId);
                    const network = networks.find(x => x.isDefault) ?? networks[0];
                    const node = await this.networkService.getNode(network.chainId);
                    const pxe = this.pxeService.getPXE(network);

                    const toDiscover: { instance: any; artifact: any }[] = [];

                    if (!hasSponsoredFpc) {
                        const instance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
                            constructorArgs: [],
                            salt: new Fr(BigInt("0x2a0f57c183e73d3390f80b6b28e57593d6faea3517eb57604491220173ad2f32")),
                        });
                        toDiscover.push({ instance, artifact: SponsoredFPCContractArtifact });
                    }
                    if (!hasBridgedFpc) {
                        const instance = await getContractInstanceFromInstantiationParams(BridgedFPCContractArtifact, {
                            constructorArgs: [],
                            salt: Fr.zero(),
                            deployer: AztecAddress.ZERO,
                        });
                        toDiscover.push({ instance, artifact: BridgedFPCContractArtifact });
                    }

                    for (const { instance: contractInstance, artifact: contractArtifact } of toDiscover) {
                        try {
                            await pxe.registerContract({ instance: contractInstance, artifact: contractArtifact });
                            this.logInfo(`Registered protocol FPC: ${contractInstance.address.toString()}`);

                            const type = this.detectFpcType(contractArtifact);
                            const fpcHandler = getFpcHandler(type);
                            fpcHandler.validateArtifact(contractArtifact);

                            const asset = await fpcHandler.getAsset(contractInstance.address.toString(), pxe, node);
                            const acceptsPrivate = fpcHandler.acceptsPrivate();
                            const acceptsPublic = fpcHandler.acceptsPublic();

                            let id: string;
                            do {
                                id = getRandomHex(8);
                            } while (await this.storage.contains(id));
                            const fpc: FpcInfo = {
                                id,
                                profileId: profile.id,
                                chainId,
                                type,
                                address: contractInstance.address.toString(),
                                name: type === FpcType.BridgedFpc ? "Private Fee Juice" : undefined,
                                asset,
                                acceptsPrivate,
                                acceptsPublic,
                            };
                            await this.storage.set(id, fpc);
                            result.push(fpc);
                        } catch (err) {
                            this.logError(`Failed to discover FPC ${contractInstance.address.toString()}`, err);
                        }
                    }
                } finally {
                    this.lock.leave();
                }
            }
        }
        return result;
    }

    public async getFpc(id: string): Promise<FpcInfo> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const fpcInfo = await this.storage.get(id);
        if (fpcInfo?.profileId !== profile.id) {
            throw new Error("Invalid id");
        }
        return fpcInfo;
    }

    public async addFpc(networkId: string, type: FpcType, address: string, name?: string): Promise<FpcInfo> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const network = await this.networkService.getNetwork(networkId);
        const node = await this.networkService.getNode(network.chainId);
        const pxe = this.pxeService.getPXE(network);

        const fpcInstance = await pxe.getContractInstance(AztecAddress.fromString(address));
        if (!fpcInstance) {
            throw new Error("Contract instance not found");
        }

        const fpcArtifact = await pxe.getContractArtifact(
            fpcInstance.currentContractClassId,
        );
        if (!fpcArtifact) {
            throw new Error("Contract artifact not found");
        }

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === address)) {
            await pxe.registerContract({
                instance: fpcInstance,
                artifact: fpcArtifact,
            });
        }

        const fpcHandler = getFpcHandler(type);
        fpcHandler.validateArtifact(fpcArtifact);

        const asset = await fpcHandler.getAsset(address, pxe, node);
        const acceptsPrivate = fpcHandler.acceptsPrivate();
        const acceptsPublic = fpcHandler.acceptsPublic();

        try {
            await this.lock.enter();
            let id: string;
            do {
                id = getRandomHex(8);
            } while (await this.storage.contains(id));
            const fpc: FpcInfo = {
                id,
                profileId: profile.id,
                chainId: network.chainId,
                type,
                address,
                name,
                asset,
                acceptsPrivate,
                acceptsPublic,
            };
            await this.storage.set(id, fpc);
            this.emit("onFpcAdded", fpc);
            return fpc;
        } finally {
            this.lock.leave();
        }
    }

    public async updateFpc(id: string, name: string): Promise<FpcInfo> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        try {
            await this.lock.enter();
            const fpc = await this.storage.get(id);
            if (fpc?.profileId !== profile.id) {
                throw new Error("Invalid id");
            }
            fpc.name = name;
            await this.storage.set(id, fpc);
            this.emit("onFpcUpdated", fpc);
            return fpc;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteFpc(id: string): Promise<FpcInfo> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        try {
            await this.lock.enter();
            const fpc = await this.storage.get(id);
            if (fpc?.profileId !== profile.id) {
                throw new Error("Invalid id");
            }
            await this.storage.delete(id);
            this.emit("onFpcDeleted", fpc);
            return fpc;
        } finally {
            this.lock.leave();
        }
    }

    public async getFpcImpl(id: string): Promise<Fpc> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const fpcInfo = await this.storage.get(id);
        if (fpcInfo?.profileId !== profile.id) {
            throw new Error("Invalid id");
        }
        const fpcHandler = getFpcHandler(fpcInfo.type);
        return new Fpc(fpcInfo, fpcHandler);
    }

    /**
     * Detect FPC type from contract artifact by inspecting function signatures.
     * - `sponsor_unconditionally` → DefaultSponsoredFpc
     * - `pay_fee` + `balance_of` (no `sponsor_unconditionally`) → BridgedFpc
     * - `get_accepted_asset` → DefaultFpc
     */
    private detectFpcType(artifact: { name: string; functions: { name: string }[] }): FpcType {
        const hasSponsorUnconditionally = artifact.functions.some(f => f.name === "sponsor_unconditionally");
        if (hasSponsorUnconditionally) {
            return FpcType.DefaultSponsoredFpc;
        }

        const hasPayFee = artifact.functions.some(f => f.name === "pay_fee");
        const hasBalanceOf = artifact.functions.some(f => f.name === "balance_of");
        if (hasPayFee && hasBalanceOf) {
            return FpcType.BridgedFpc;
        }

        if (artifact.name === "FPC" || artifact.functions.some(f => f.name === "get_accepted_asset")) {
            return FpcType.DefaultFpc;
        }

        return FpcType.DefaultSponsoredFpc;
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`Profile ${profile.id} deleted, remove related FPCs`);
        try {
            await this.lock.enter();
            const fpcs = (await this.storage.getValues()).filter(fpc => fpc.profileId === profile.id);
            for (const fpc of fpcs) {
                this.logDebug(`Remove fpc #${fpc.id}`);
                await this.storage.delete(fpc.id);
                this.emit("onFpcDeleted", fpc);
            }
        } finally {
            this.lock.leave();
        }
    };

    public async backup(): Promise<FpcInfo[]> {
        return (await this.getFpcs());
    }

    public async restore(fpcs: FpcInfo[]): Promise<Restored<FpcInfo>[]> {
        await this.ensureInitialized();

        const result: Restored<FpcInfo>[] = [];
        try {
            await this.lock.enter();

            for (const fpc of fpcs) {
                try {
                    let id = fpc.id;
                    while ((await this.storage.contains(id))) {
                        id = getRandomHex(8);
                    }

                    await this.storage.set(id, { ...fpc, id });
                    result.push({ ...fpc, id });
                } catch (err) {
                    result.push({
                        ...fpc,
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
