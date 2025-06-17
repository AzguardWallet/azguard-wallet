import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { ProfileService } from "@/wallet/services/profile";
import type { NetworkService } from "@/wallet/services/network";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { type ILogs, LogLevel } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    type GetFpcsRequest,
    GetFpcsResponse,
    type GetFpcRequest,
    GetFpcResponse,
    type AddFpcRequest,
    AddFpcResponse,
    type UpdateFpcRequest,
    UpdateFpcResponse,
    type DeleteFpcRequest,
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
    private readonly pxeService: PxeServiceClient;
    private readonly storage: EntityStorage<FpcInfo>;
    private readonly lock = new Lock();

    constructor(
        private readonly profiles: ProfileService,
        private readonly networks: NetworkService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void,
    ) {
        super(FPC_SERVICE_NAME, logger, emit);
        this.pxeService = new PxeServiceClient();
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
            case FpcServiceMethod.GetFpc: {
                const _request = request as GetFpcRequest;
                try {
                    const result = await this.getFpc(_request.fpcId);
                    return new GetFpcResponse(_request, result.infoData);
                } catch (error: any) {
                    return new GetFpcResponse(_request, undefined, error.message);
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
            case FpcServiceMethod.UpdateFpc: {
                const _request = request as UpdateFpcRequest;
                try {
                    const result = await this.updateFpc(
                        _request.fpcId,
                        _request.name,
                    );
                    return new UpdateFpcResponse(_request, result);
                } catch (error: any) {
                    return new UpdateFpcResponse(_request, undefined, error.message);
                }
            }            case FpcServiceMethod.DeleteFpc: {
                const _request = request as DeleteFpcRequest;
                try {
                    const result = await this.deleteFpc(_request.fpcId);
                    return new DeleteFpcResponse(_request, result);
                } catch (error: any) {
                    return new DeleteFpcResponse(_request, undefined, error.message);
                }
            }
            default: {
                this.log(LogLevel.Error, `Invalid request method ${request.method}.`);
                // console.error(`Invalid request method ${request.method}.`);
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
            this.log(LogLevel.Info, "Discovering FPCs...");
            // console.log("Discovering FPCs...");
            try {
                await this.lock.enter();
                const networks = await this.networks.getNetworks(chainId);
                const network = networks.find(x => x.isDefault) ?? networks[0];
                const pxe = this.pxeService.getPXE(network);

                for (const contract of [
                    AztecAddress.fromString("0x0c2246629438e708f452e924d05bb1521047eaf21fa9c98978cc0bf459a7c081"),
                    AztecAddress.fromString("0x1260a43ecf03e985727affbbe3e483e60b836ea821b6305bea1c53398b986047"),
                ]) {
                    const contractMeta = await pxe.getContractMetadata(contract);
                    if (contractMeta.contractInstance) {
                        const classMeta = await pxe.getContractClassMetadata(
                            contractMeta.contractInstance.currentContractClassId,
                        );
                        if (classMeta.artifact) {
                            this.log(LogLevel.Info, `Found FPC: ${contract.toString()}`);
                            // console.log(`Found FPC: ${contract.toString()}`);

                            const registeredContracts = await pxe.getContracts();
                            if (!registeredContracts.find(x => x.toString() === contract.toString())) {
                                await pxe.registerContract({
                                    instance: contractMeta.contractInstance,
                                    artifact: classMeta.artifact,
                                });
                            }

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
                                chainId,
                                type,
                                contract.toString(),
                                undefined,
                                asset,
                                acceptsPrivate,
                                acceptsPublic,
                            );
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

    public async addFpc(networkId: string, type: FpcType, address: string, name?: string): Promise<FpcInfo> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const network = await this.networks.getNetwork(networkId);
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

    public async updateFpc(fpcId: string, name: string): Promise<FpcInfo> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        try {
            await this.lock.enter();
            const fpc = await this.storage.get(fpcId);
            if (fpc?.profileId !== profile.id) {
                throw new Error("Invalid id");
            }

            const newFpc = {
                ...fpc,
                name,
            };
            await this.storage.set(fpcId, newFpc);
            this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcUpdated, newFpc));
            return newFpc;
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
        this.log(LogLevel.Debug, `profile ${profileId} deleted, remove related FPCs`);
        // console.debug(`profile ${profileId} deleted, remove related FPCs`);
        try {
            await this.lock.enter();
            const fpcs = (await this.storage.getValues()).filter(fpc => fpc.profileId === profileId);
            for (const fpc of fpcs) {
                this.log(LogLevel.Debug, `remove fpc #${fpc.id}`);
                // console.debug(`remove fpc #${fpc.id}`);
                await this.storage.delete(fpc.id);
                this.emit(new FpcServiceEventMessage(FpcServiceEvent.FpcDeleted, fpc));
            }
        } finally {
            this.lock.leave();
        }
    };
}
