import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import { TxHash } from "@aztec/stdlib/tx";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { NetworkService } from "@/wallet/services/network/service";
import { EventHandler } from "@/wallet/utils/event-handler";
import { getErrorMessage } from "@/wallet/utils/errors";
import { ACCOUNT_STATE_SERVICE_NAME, Events, Methods } from "./spec";

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
            const sender = (await this.pxeService.registerSender(network, AztecAddress.fromString(address))).toString();
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
            await this.pxeService.removeSender(network, AztecAddress.fromString(address));
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

    public async getVersion(networkId: string): Promise<string> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const pxeInfo = await this.pxeService.getPXEInfo(network);
            return pxeInfo.pxeVersion;
        } catch (error) {
            this.logError("Failed to fetch PXE info", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }
}
