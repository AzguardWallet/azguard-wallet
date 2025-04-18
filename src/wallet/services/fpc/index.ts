import { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import type { ProfileService } from "@/wallet/services/profile";
import type { NetworkService } from "@/wallet/services/network";
import type { PxeService } from "@/wallet/services/pxe";
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
    private readonly storage: EntityStorage<FpcInfo>;
    private readonly lock = new Lock();

    constructor(
        private readonly profiles: ProfileService,
        private readonly networks: NetworkService,
        private readonly pxeService: PxeService,
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
                const pxe = await this.pxeService.getPXEClient(chainId);

                for (const contract of [
                    AztecAddress.fromString("0x097d86b77f924ecf8c7c6e058db2268b21615bf860ca4e87f0254fad6dee7dde"),
                    AztecAddress.fromString("0x0b27e30667202907fc700d50e9bc816be42f8141fae8b9f2281873dbdb9fc2e5"),
                    AztecAddress.fromString("0x28c18c0fc136706445df221b4d80d72a4464ef278b62c5de196dd3bd0527c938"),
                ]) {
                    const contractMeta = await this.pxeService.getContractMetadata(chainId, contract);
                    if (contractMeta.contractInstance) {
                        const classMeta = await this.pxeService.getContractClassMetadata(
                            chainId,
                            contractMeta.contractInstance.currentContractClassId,
                        );
                        if (classMeta.artifact) {
                            console.log(`Found FPC: ${contract.toString()}`);

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
        const pxe = await this.pxeService.getPXEClient(network.chainId);

        const fpcMetadata = await this.pxeService.getContractMetadata(network.chainId, AztecAddress.fromString(address));
        if (!fpcMetadata.contractInstance) {
            throw new Error("Contract instance not found");
        }

        const fpcClassMetadata = await this.pxeService.getContractClassMetadata(
            network.chainId,
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
