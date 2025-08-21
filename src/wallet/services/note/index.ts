import { ContractNote, FieldLayout } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { NoteStatus, UniqueNote } from "@aztec/stdlib/note";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { ILogs } from "@/wallet/services/logger/client";
import type { NetworkService } from "@/wallet/services/network";
import { Network } from "@/wallet/services/network/client";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { type GetNotesRequest, GetNotesResponse, Note, NOTE_SERVICE_NAME, NoteServiceMethod } from "./client";

export class NoteService extends Service {
    private readonly pxeService: PxeServiceClient;
    private readonly contractNotesCache: Map<string, ContractNote[]> = new Map();
    private readonly contractStorageCache: Map<string, [string, FieldLayout][]> = new Map();

    constructor(
        private readonly networks: NetworkService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void,
    ) {
        super(NOTE_SERVICE_NAME, logger, emit);
        this.pxeService = new PxeServiceClient();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case NoteServiceMethod.GetNotes: {
                const _request = request as GetNotesRequest;
                try {
                    const notes = await this.getNotes(_request.networkId, _request.account, _request.contract);
                    return new GetNotesResponse(_request, notes);
                } catch (error: any) {
                    return new GetNotesResponse(_request, undefined, error.message);
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async getNotes(networkId: string, account: string, contract?: string): Promise<Note[]> {
        const network = await this.networks.getNetwork(networkId);
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
                    true,
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

            return new Note(
                contract,
                note.storageSlot.toString(),
                note.txHash.toString(),
                note.note.items.map(x => x.toString()),
                contractNotes.map(x => x.typ).join(" | "),
                location,
                content,
            );
        } catch (error) {
            this.logError(
                "Failed to parse note",
                (error as Error)?.message ?? (error as string) ?? "unknown error",
                note,
            );
            return new Note(
                note.contractAddress.toString(),
                note.storageSlot.toString(),
                note.txHash.toString(),
                note.note.items.map(x => x.toString()),
            );
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
