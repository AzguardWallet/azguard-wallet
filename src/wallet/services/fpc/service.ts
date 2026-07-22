import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { AccountService, Account } from "@/wallet/services/account/service";
import { NetworkService } from "@/wallet/services/network/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Fpc } from "./fpc";
import { getFpcHandler, resolveCanonicalFpcs } from "./handlers";
import { Events, FPC_SERVICE_NAME, FpcInfo, FpcType, Methods } from "./spec";

export * from "./fpc";
export * from "./spec";

/** Records that default FPCs were seeded for a profile+chain, so seeding runs at most
 * once — a user deletion is never undone by a later account. */
type Provisioned = { profileId: string; chainId: number };

export class FpcService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = FPC_SERVICE_NAME;

    public readonly onFpcAdded = new EventHandler<FpcInfo>();
    public readonly onFpcUpdated = new EventHandler<FpcInfo>();
    public readonly onFpcDeleted = new EventHandler<FpcInfo>();

    private readonly storage = new EntityStorage<FpcInfo>("azguard:core:fpcs", StorageType.Local);
    // Per-profile+chain marker that default FPCs were seeded — makes seeding one-shot, so
    // deletions stick and later accounts don't re-run it.
    private readonly provisioned = new EntityStorage<Provisioned>("azguard:core:fpcs-provisioned", StorageType.Local);
    private readonly lock = new Lock();

    private pxeService: PxeServiceClient = null!;
    private profileService: ProfileService = null!;
    private accountService: AccountService = null!;
    private networkService: NetworkService = null!;

    public constructor(logger: ILogger) {
        super(FPC_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profileService = services.get(ProfileService.name);
        this.accountService = services.get(AccountService.name);
        this.networkService = services.get(NetworkService.name);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
        this.accountService.onAccountAdded.add(this.onAccountAdded);
    }

    public async getFpcs(chainId?: number): Promise<FpcInfo[]> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        return (await this.storage.getValues()).filter(
            fpc => fpc.profileId === profile.id && (chainId === undefined || fpc.chainId === chainId),
        );
    }

    private provisionedKey(profileId: string, chainId: number): string {
        return `${profileId}:${chainId}`;
    }

    /** A storage id not currently in use. Call sites hold the lock while persisting. */
    private async newId(): Promise<string> {
        let id: string;
        do {
            id = getRandomHex(8);
        } while (await this.storage.contains(id));
        return id;
    }

    /** Seed the canonical default FPCs for a profile+chain, exactly once (guarded by the
     * `provisioned` marker) — so a user deletion is never undone by a later account.
     * Sole trigger is account creation (onAccountAdded). Best-effort: network/resolve
     * failures are logged, never thrown, and leave the marker unset so the next account
     * retries. Emits onFpcAdded per newly seeded FPC. */
    private async seedCanonicalFpcs(profileId: string, chainId: number): Promise<void> {
        const key = this.provisionedKey(profileId, chainId);
        if (await this.provisioned.contains(key)) return;
        try {
            await this.lock.enter();
            if (await this.provisioned.contains(key)) return; // lost the race while waiting

            const network = await this.networkService.getDefaultNetwork(chainId);
            if (!network) return; // not ready — leave unprovisioned, retry on next account

            const pxe = this.pxeService.getPXE(network);
            const node = await this.networkService.getNode(network.chainId);
            const registeredContracts = await pxe.getContracts();
            const storedAddresses = new Set(
                (await this.storage.getValues())
                    .filter(fpc => fpc.profileId === profileId && fpc.chainId === chainId)
                    .map(fpc => fpc.address),
            );

            for (const { type, contractInstance, contractArtifact } of await resolveCanonicalFpcs(chainId, pxe)) {
                const address = contractInstance.address.toString();
                if (storedAddresses.has(address)) continue;
                this.logInfo(`Seeding default FPC: ${address}`);

                if (!registeredContracts.find(x => x.toString() === address)) {
                    await pxe.ensureContractRegistered({
                        instance: contractInstance,
                        artifact: contractArtifact,
                    });
                }

                const handler = getFpcHandler(type);
                handler.validateArtifact(contractArtifact);
                const asset = await handler.getAsset(address, pxe, node);
                const id = await this.newId();
                const fpc: FpcInfo = {
                    id,
                    profileId,
                    chainId,
                    type,
                    source: "seeded",
                    address,
                    name: undefined,
                    asset,
                    acceptsPrivate: handler.acceptsPrivate(),
                    acceptsPublic: handler.acceptsPublic(),
                };
                await this.storage.set(id, fpc);
                this.emit("onFpcAdded", fpc);
            }
            await this.provisioned.set(key, { profileId, chainId });
        } catch (e) {
            this.logError(`Failed to seed default FPCs for chain ${chainId}`, `${e}`);
        } finally {
            this.lock.leave();
        }
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

        const fpcInstance = await pxe.getContractInstance(AztecAddress.fromStringUnsafe(address));
        if (!fpcInstance) {
            this.logError("Failed to add FPC: contract instance not found", address);
            throw new Error("Contract instance not found");
        }

        const fpcArtifact = await pxe.getContractArtifact(fpcInstance.originalContractClassId);
        if (!fpcArtifact) {
            this.logError(
                "Failed to add FPC: contract artifact not found",
                fpcInstance.originalContractClassId.toString(),
            );
            throw new Error("Contract artifact not found");
        }

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === address)) {
            await pxe.ensureContractRegistered({
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
            const id = await this.newId();
            const fpc: FpcInfo = {
                id,
                profileId: profile.id,
                chainId: network.chainId,
                type,
                source: "user",
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

    // The one automatic seeding trigger: seed default FPCs the moment an account exists
    // for a profile+chain. seedCanonicalFpcs is one-shot, so later accounts are no-ops.
    private readonly onAccountAdded = async (account: Account) => {
        await this.seedCanonicalFpcs(account.profileId, account.chainId);
    };

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
            for (const [key, record] of await this.provisioned.getAll()) {
                if (record.profileId === profile.id) {
                    await this.provisioned.delete(key);
                }
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
