import { createPXEClient } from "@aztec/aztec.js";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { ProfileService } from "@/wallet/services/profile";
import { NetworkService } from "@/wallet/services/network";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    GetFpcsRequest,
    GetFpcsResponse,
    AddFpcRequest,
    AddFpcResponse,
    DeleteFpcRequest,
    DeleteFpcResponse,
    FpcInfo,
    FpcType,
    FPC_SERVICE_NAME,
    FpcServiceEvent,
    FpcServiceEventMessage,
    FpcServiceMethod,
} from "./client";
import { Fpc } from "./fpc";
import { getFpcHandler } from "./handlers";

export class FpcService extends Service {
    private readonly storage: EntityStorage<FpcInfo>;
    private readonly lock = new Lock();

    constructor(
        private readonly profiles: ProfileService,
        private readonly networks: NetworkService,
        emit: (event: EventMessage) => void,
    ) {
        super(FPC_SERVICE_NAME, emit);
        this.storage = new EntityStorage("azguard:core:fpcs", StorageType.Local);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case FpcServiceMethod.GetFpcs: {
                const _request = request as GetFpcsRequest;
                try {
                    const result = await this.getFpcs(_request.chainId);
                    return new GetFpcsResponse(_request, result);
                } catch (error: any) {
                    return new GetFpcsResponse(_request, undefined, error.message);
                }
            }
            case FpcServiceMethod.AddFpc: {
                const _request = request as AddFpcRequest;
                try {
                    const result = await this.addFpc(
                        _request.networkId,
                        _request.fpcType,
                        _request.fpcAddress,
                        _request.fpcName,
                    );
                    return new AddFpcResponse(_request, result);
                } catch (error: any) {
                    return new AddFpcResponse(_request, undefined, error.message);
                }
            }
            case FpcServiceMethod.DeleteFpc: {
                const _request = request as DeleteFpcRequest;
                try {
                    const result = await this.deleteFpc(_request.fpcId);
                    return new DeleteFpcResponse(_request, result);
                } catch (error: any) {
                    return new DeleteFpcResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async getFpcs(chainId?: number): Promise<Array<FpcInfo>> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const result = (await this.storage.getValues()).filter(
            fpc => fpc.profileId === profile.id && (chainId === undefined || fpc.chainId === chainId),
        );
        // TODO: remove it
        if (!result.length && chainId) {
            console.log("Discovering FPCs...");
            try {
                await this.lock.enter();
                const network = (await this.networks.getNetworks(chainId)).find(x => x.isDefault);
                if (network) {
                    const pxe = createPXEClient(network.rpcUrl);
                    for (const contract of await pxe.getContracts()) {
                        const contractMeta = await pxe.getContractMetadata(contract);
                        if (contractMeta.contractInstance) {
                            const classMeta = await pxe.getContractClassMetadata(
                                contractMeta.contractInstance.currentContractClassId,
                                true,
                            );
                            if (classMeta.artifact?.name === "FPC" || classMeta.artifact?.name === "SponsoredFPC") {
                                console.log(`Found FPC: ${contract.toString()}`);
                                const type = classMeta.artifact.name === "FPC"
									? FpcType.DefaultFpc
									: FpcType.DefaultSponsoredFpc;
                                const fpcHandler = getFpcHandler(type);
                                fpcHandler.validateArtifact(classMeta.artifact);

                                const asset = await fpcHandler.getAsset(contract.toString(), pxe);
                                const acceptsPrivate = fpcHandler.acceptsPrivate();
                                const acceptsPublic = fpcHandler.acceptsPublic();

                                let id: string;
                                do {
                                    id = getRandomHex(8);
                                } while (await this.storage.contains(id));
                                const fpc = new FpcInfo(
                                    id,
                                    profile.id,
                                    network.chainId,
                                    type,
                                    contract.toString(),
                                    undefined,
                                    asset,
                                    acceptsPrivate,
                                    acceptsPublic,
                                );
                                await this.storage.set(id, fpc);
                                this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcAdded, fpc));
                                result.push(fpc);
                            }
                        }
                    }
                }
            } finally {
                this.lock.leave();
            }
        }
        return result;
    }

    public async addFpc(networkId: string, type: FpcType, address: string, name?: string): Promise<FpcInfo> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const network = await this.networks.getNetwork(networkId);
        const pxe = createPXEClient(network.rpcUrl);

        const fpcMetadata = await pxe.getContractMetadata(AztecAddress.fromString(address));
        if (!fpcMetadata.contractInstance) {
            throw new Error("Contract instance not found");
        }

        const fpcClassMetadata = await pxe.getContractClassMetadata(
            fpcMetadata.contractInstance.currentContractClassId,
            true,
        );
        if (!fpcClassMetadata.artifact) {
            throw new Error("Contract artifact not found");
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
            const fpc = new FpcInfo(
                id,
                profile.id,
                network.chainId,
                type,
                address,
                name,
                asset,
                acceptsPrivate,
                acceptsPublic,
            );
            await this.storage.set(id, fpc);
            this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcAdded, fpc));
            return fpc;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteFpc(id: string): Promise<FpcInfo> {
        const profile = await this.profiles.getActiveProfile();
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
            this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcDeleted, fpc));
            return fpc;
        } finally {
            this.lock.leave();
        }
    }

    public async getFpc(id: string): Promise<Fpc> {
        const profile = await this.profiles.getActiveProfile();
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

    private readonly onProfileDeleted = async (profileId: string) => {
        console.debug(`profile ${profileId} deleted, remove related FPCs`);
        try {
            await this.lock.enter();
            const fpcs = (await this.storage.getValues()).filter(fpc => fpc.profileId === profileId);
            for (const fpc of fpcs) {
                console.debug(`remove fpc #${fpc.id}`);
                await this.storage.delete(fpc.id);
                this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcDeleted, fpc));
            }
        } finally {
            this.lock.leave();
        }
    };
}
