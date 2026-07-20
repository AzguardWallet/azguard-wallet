import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { NetworkService } from "@/wallet/services/network/service";
import { type Network } from "@/wallet/services/network/spec"
import { NodeStatus } from "@/wallet/services/network/spec"
import { EventHandler } from "@/wallet/utils/event-handler";
import { getErrorMessage } from "@/wallet/utils/errors";
import { ACCOUNT_STATE_SERVICE_NAME, BackupAccountState, BackupContract, BackupSender, Events, Methods } from "./spec";

export * from "./spec";

export class AccountStateService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = ACCOUNT_STATE_SERVICE_NAME;

    public readonly onSenderAdded = new EventHandler<string>();
    public readonly onSenderDeleted = new EventHandler<string>();

    private pxeService: PxeServiceClient = null!;
    private networkService: NetworkService = null!;

    public constructor(logger: ILogger) {
        super(ACCOUNT_STATE_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.networkService = services.get(NetworkService.name);
    }

    public async getAccounts(networkId: string): Promise<string[]> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const accounts = await this.pxeService.getRegisteredAccounts(network);
            return accounts.map(x => x.address.toString());
        } catch (error) {
            this.logError("Failed to fetch registered accounts", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    public async getSenders(networkId: string): Promise<string[]> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const senders = await this.pxeService.getSenders(network);
            return senders.map(x => x.toString());
        } catch (error) {
            this.logError("Failed to fetch registered senders", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    public async addSender(networkId: string, address: string): Promise<string> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const sender = (await this.pxeService.registerSender(network, AztecAddress.fromStringUnsafe(address))).toString();
            this.emit("onSenderAdded", sender);
            return sender;
        } catch (error) {
            this.logError("Failed to register sender", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    public async deleteSender(networkId: string, address: string): Promise<string> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            await this.pxeService.removeSender(network, AztecAddress.fromStringUnsafe(address));
            this.emit("onSenderDeleted", address);
            return address;
        } catch (error) {
            this.logError("Failed to remove sender", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    public async getContracts(networkId: string): Promise<string[]> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const contracts = await this.pxeService.getContracts(network);
            return contracts.map(x => x.toString());
        } catch (error) {
            this.logError("Failed to fetch registered contracts", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    public async backup(): Promise<BackupAccountState[] | undefined> {
        const networks = (await this.networkService.getNetworks());
        if (!networks.length) {
            return undefined;
        }

        const result: BackupAccountState[] = [];

        const seenChainIds = new Set<number>();
        const uniqueNetworks = networks.filter(n => {
            if (seenChainIds.has(n.chainId)) return false;
            seenChainIds.add(n.chainId);
            return true;
        });
        for (const n of uniqueNetworks) {
            if ((await this.networkService.getNodeStatus(n.id)) === NodeStatus.Active) {
                const senders = await this.getSenders(n.id);
                const contracts = await this.getContracts(n.id);
                const contractsFull: BackupContract[] = []
                for (const c of contracts) {
                    const instance = await this.pxeService.getContractInstance(n, AztecAddress.fromStringUnsafe(c));
                    if (!instance) continue;

                    const artifact = await this.pxeService.getContractArtifact(n, instance.originalContractClassId);
                    if (!artifact) continue;

                    contractsFull.push({
                        address: c,
                        instance,
                        artifact,
                    })
                }

                result.push({
                    networkId: n.id,
                    senders: senders.map(address => ({ address })),
                    contracts: contractsFull,
                });
            }
        }

        return result;
    }

    public async restore(backupAccountState: BackupAccountState[], networks: Network[]): Promise<Restored<BackupAccountState>[]> {
        await this.ensureInitialized();

        const result: Restored<BackupAccountState>[] = [];

        for (const item of backupAccountState) {
            const senders: Restored<BackupSender>[] = [];
            const contracts: Restored<BackupContract>[] = [];
            const network = networks.find(n => n.id === item.networkId);
            for (const sender of item.senders) {
                try {
                    if (!network) throw new Error("Network not found");

                    await this.pxeService.registerSender(network, AztecAddress.fromStringUnsafe(sender.address));
                    senders.push(sender);
                } catch (err) {
                    senders.push({
                        ...sender,
                        restoreError: err instanceof Error ? err.message : err,
                    });
                }
            }

            for (const contract of item.contracts) {
                try {
                    if (!network) throw new Error("Network not found");
                    
                    const addressNum = AztecAddress.fromStringUnsafe(contract.address).toBigInt();
                    if (addressNum >= 0 && addressNum <= 6) {
                        // ignore protocol contracts registration,
                        // because we cannot validate it due to hardcoded addresses
                        continue;
                    }
                    
                    await this.pxeService.ensureContractRegistered(network, {
                        instance: contract.instance,
                        artifact: contract.artifact,
                    });
                    contracts.push(contract);
                } catch(err) {
                    contracts.push({
                        ...contract,
                        restoreError: err instanceof Error ? err.message : err,
                    });
                }
            }

            result.push({
                networkId: item.networkId,
                senders,
                contracts,
            });
        }

        return result;
    }
}
