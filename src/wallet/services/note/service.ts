import { /*ContractNote,*/ FieldLayout } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { NoteStatus, NoteDao } from "@aztec/stdlib/note";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { NetworkService, Network } from "@/wallet/services/network/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { getErrorMessage } from "@/wallet/utils/errors";
import { Methods, Note, NOTE_SERVICE_NAME } from "./spec";

export * from "./spec";

export class NoteService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = NOTE_SERVICE_NAME;

    //private readonly contractNotesCache: Map<string, ContractNote[]> = new Map();
    private readonly contractStorageCache: Map<string, [string, FieldLayout][]> = new Map();

    private pxeService: PxeServiceClient = null!;
    private networkService: NetworkService = null!;

    public constructor(logger: ILogger) {
        super(NOTE_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.networkService = services.get(NetworkService.name);
    }

    public async getNotes(networkId: string, account: string, contract?: string): Promise<Note[]> {
        await this.ensureInitialized();
        const network = await this.networkService.getNetwork(networkId);
        try {
            const notes = contract
                ? await this.fetchContractNotes(network, account, AztecAddress.fromString(contract))
                : await this.fetchKnownContractsNotes(network, account);
            const res = [];
            for (const note of notes) {
                res.push(await this.parseNote(network, note));
            }
            return res;
        } catch (error) {
            this.logError("Failed to fetch incoming notes", getErrorMessage(error));
            throw new Error("PXE request failed");
        }
    }

    private async fetchKnownContractsNotes(network: Network, account: string): Promise<NoteDao[]> {
        const res = [];
        const knownContracts = await this.pxeService.getContracts(network);
        for (const contract of knownContracts.filter(x => x.toBigInt() > 6n)) {
            res.push(...(await this.fetchContractNotes(network, account, contract)));
        }
        return res;
    }

    private async fetchContractNotes(network: Network, account: string, contract: AztecAddress): Promise<NoteDao[]> {
        return await this.pxeService.getNotes(network, {
            contractAddress: contract,
            status: NoteStatus.ACTIVE,
            scopes: [AztecAddress.fromString(account)],
        });
    }

    private async parseNote(network: Network, note: NoteDao): Promise<Note> {
        return {
            contract: note.contractAddress.toString(),
            storageSlot: note.storageSlot.toString(),
            txHash: note.txHash.toString(),
            rawContent: note.note.items.map(x => x.toString()),
        };
    }
}
