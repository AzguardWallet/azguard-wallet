import { ContractNote, FieldLayout } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { NoteStatus, UniqueNote } from "@aztec/stdlib/note";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { NetworkService, Network } from "@/wallet/services/network/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { Methods, Note, NOTE_SERVICE_NAME } from "./spec";

export * from "./spec";

export class NoteService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = NOTE_SERVICE_NAME;

    private readonly contractNotesCache: Map<string, ContractNote[]> = new Map();
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
            const notes = await this.pxeService.getNotes(network, {
                contractAddress: contract ? AztecAddress.fromString(contract) : undefined,
                recipient: AztecAddress.fromString(account),
                status: NoteStatus.ACTIVE,
            });
            const res = [];
            for (const note of notes) {
                res.push(await this.parseNote(network, note));
            }
            return res;
        } catch (error) {
            this.logError("Failed to fetch incoming notes", error);
            throw new Error("PXE request failed");
        }
    }

    public async parseNote(network: Network, note: UniqueNote): Promise<Note> {
        try {
            const contract = note.contractAddress.toString();
            let contractNotes = this.contractNotesCache.get(contract);
            let storageLayout = this.contractStorageCache.get(contract);
            if (!contractNotes || !storageLayout) {
                const { contractInstance } = await this.pxeService.getContractMetadata(network, note.contractAddress);
                if (!contractInstance) {
                    throw new Error("Unknown contract instance");
                }
                const { artifact } = await this.pxeService.getContractClassMetadata(
                    network,
                    contractInstance.currentContractClassId,
                );
                if (!artifact) {
                    throw new Error("Unknown contract class");
                }
                contractNotes = Object.values(artifact.notes);
                storageLayout = Object.entries(artifact.storageLayout);
                this.contractNotesCache.set(contract, contractNotes);
                this.contractStorageCache.set(contract, storageLayout);
            }
            let location = storageLayout.find(x => x[1].slot.equals(note.storageSlot))?.[0];
            if (!location) {
                for (const [k, v] of storageLayout) {
                    if (note.storageSlot.equals(await deriveStorageSlotInMap(v.slot, note.recipient))) {
                        location = k;
                        break;
                    }
                }
            }
            if (contractNotes.length > 1) {
                contractNotes = contractNotes.filter(n => n.fields.every(f => f.index < note.note.length));
                if (contractNotes.length > 1 && location !== undefined) {
                    const path = location.toLowerCase();
                    if (path.includes("balance")) {
                        const uintNote = contractNotes.find(x => x.typ === "UintNote");
                        if (uintNote) {
                            contractNotes = [uintNote];
                        }
                    } else if (path.includes("nft")) {
                        const nftNote = contractNotes.find(x => x.typ === "NFTNote");
                        if (nftNote) {
                            contractNotes = [nftNote];
                        }
                    }
                }
            }
            const content = contractNotes.length === 1 ? this.parseNoteContent(note, contractNotes[0]) : undefined;

            return {
                contract,
                storageSlot: note.storageSlot.toString(),
                txHash: note.txHash.toString(),
                rawContent: note.note.items.map(x => x.toString()),
                type: contractNotes.map(x => x.typ).join(" | "),
                location,
                content,
            };
        } catch (error) {
            this.logError(
                "Failed to parse note",
                (error as Error)?.message ?? (error as string) ?? "unknown error",
                note,
            );
            return {
                contract: note.contractAddress.toString(),
                storageSlot: note.storageSlot.toString(),
                txHash: note.txHash.toString(),
                rawContent: note.note.items.map(x => x.toString()),
            };
        }
    }

    parseNoteContent(note: UniqueNote, type: ContractNote): Record<string, string> {
        type.fields.sort((a, b) => a.index - b.index);
        const content: Record<string, string> = {};
        for (let i = 0; i < type.fields.length; i++) {
            const field = type.fields[i].name;
            const rawValue = note.note.items.slice(type.fields[i].index, type.fields.at(i + 1)?.index);
            let value: string;
            if (rawValue.length === 1) {
                switch (field) {
                    case "value":
                    case "amount":
                    case "token_id":
                    case "expiry_block_number":
                    case "remaining_txs":
                    case "points": {
                        value = rawValue[0].toBigInt().toString();
                        break;
                    }
                    default: {
                        value = rawValue[0].toString();
                        break;
                    }
                }
            } else {
                value = `0x${rawValue.map(x => x.toString().slice(2)).join()}`;
            }
            content[field] = value;
        }
        return content;
    }
}
