import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
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
        // TODO: remove it
        if (!result.length && chainId) {
            this.logInfo("Discovering FPCs...");
            try {
                await this.lock.enter();
                const networks = await this.networkService.getNetworks(chainId);
                const network = networks.find(x => x.isDefault) ?? networks[0];
                const pxe = this.pxeService.getPXE(network);

                for (const contract of [
                    AztecAddress.fromString("0x0c2246629438e708f452e924d05bb1521047eaf21fa9c98978cc0bf459a7c081"),
                    AztecAddress.fromString("0x1260a43ecf03e985727affbbe3e483e60b836ea821b6305bea1c53398b986047"),
                    AztecAddress.fromString("0x19b5539ca1b104d4c3705de94e4555c9630def411f025e023a13189d0c56f8f2"),
                    AztecAddress.fromString("0x1107c84edae4dfc000b3af5b4bf3bb1e13ee917baa2e7ad4d3f13221c865b936"),
                ]) {
                    const contractMeta = await pxe.getContractMetadata(contract);
                    if (contractMeta.contractInstance) {
                        const classMeta = await pxe.getContractClassMetadata(
                            contractMeta.contractInstance.currentContractClassId,
                        );
                        if (classMeta.artifact) {
                            this.logInfo(`Found FPC: ${contract.toString()}`);

                            const registeredContracts = await pxe.getContracts();
                            if (!registeredContracts.find(x => x.toString() === contract.toString())) {
                                await pxe.registerContract({
                                    instance: contractMeta.contractInstance,
                                    artifact: classMeta.artifact,
                                });
                            }

                            const type =
                                classMeta.artifact.name === "FPC" ? FpcType.DefaultFpc : FpcType.DefaultSponsoredFpc;
                            const fpcHandler = getFpcHandler(type);
                            fpcHandler.validateArtifact(classMeta.artifact);

                            const asset = await fpcHandler.getAsset(contract.toString(), pxe);
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
                                address: contract.toString(),
                                name: undefined,
                                asset,
                                acceptsPrivate,
                                acceptsPublic,
                            };
                            await this.storage.set(id, fpc);
                            result.push(fpc);
                        }
                    }
                }
            } finally {
                this.lock.leave();
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
        const pxe = this.pxeService.getPXE(network);

        const fpcMetadata = await pxe.getContractMetadata(AztecAddress.fromString(address));
        if (!fpcMetadata.contractInstance) {
            throw new Error("Contract instance not found");
        }

        const fpcClassMetadata = await pxe.getContractClassMetadata(
            fpcMetadata.contractInstance.currentContractClassId,
        );
        if (!fpcClassMetadata.artifact) {
            throw new Error("Contract artifact not found");
        }

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === address)) {
            await pxe.registerContract({
                instance: fpcMetadata.contractInstance,
                artifact: fpcClassMetadata.artifact,
            });
        }

        const fpcHandler = getFpcHandler(type);
        fpcHandler.validateArtifact(fpcClassMetadata.artifact);

        const asset = await fpcHandler.getAsset(address, pxe);
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
}
