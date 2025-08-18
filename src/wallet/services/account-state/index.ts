import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import { TxHash } from "@aztec/stdlib/tx";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { ILogs } from '@/wallet/services/logger/client';
import type { NetworkService } from "@/wallet/services/network";
import { PxeServiceClient } from '@/wallet/services/pxe/client';
import {
    type GetAccountsRequest,
    GetAccountsResponse,
    type GetSendersRequest,
    GetSendersResponse,
    type AddSenderRequest,
    AddSenderResponse,
    type DeleteSenderRequest,
    DeleteSenderResponse,
    type GetContractsRequest,
    GetContractsResponse,
    type GetNotesRequest,
    GetNotesResponse,
    type GetVersionRequest,
    GetVersionResponse,
    Note,
    NoteStatus,
    ACCOUNT_STATE_SERVICE_NAME,
    AccountStateServiceMethod,
    AccountStateServiceEvent,
    AccountStateServiceEventMessage,
} from "./client";

export class AccountStateService extends Service {
    private readonly pxeService: PxeServiceClient;

    constructor(
        private readonly networks: NetworkService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, logger, emit);
        this.pxeService = new PxeServiceClient();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case AccountStateServiceMethod.GetAccounts: {
                const _request = request as GetAccountsRequest;
                try {
                    const accounts = await this.getAccounts(_request.networkId);
                    return new GetAccountsResponse(_request, accounts)
                } catch (error: any) {
                    return new GetAccountsResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.GetSenders: {
                const _request = request as GetSendersRequest;
                try {
                    const res = await this.getSenders(_request.networkId);
                    return new GetSendersResponse(_request, res)
                } catch (error: any) {
                    return new GetSendersResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.AddSender: {
                const _request = request as AddSenderRequest;
                try {
                    const res = await this.addSender(_request.networkId, _request.address);
                    return new AddSenderResponse(_request, res)
                } catch (error: any) {
                    return new AddSenderResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.DeleteSender: {
                const _request = request as DeleteSenderRequest;
                try {
                    const res = await this.deleteSender(_request.networkId, _request.address);
                    return new DeleteSenderResponse(_request, res)
                } catch (error: any) {
                    return new DeleteSenderResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.GetContracts: {
                const _request = request as GetContractsRequest;
                try {
                    const contracts = await this.getContracts(_request.networkId);
                    return new GetContractsResponse(_request, contracts)
                } catch (error: any) {
                    return new GetContractsResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.GetNotes: {
                const _request = request as GetNotesRequest;
                try {
                    const notes = await this.getNotes(
                        _request.networkId,
                        _request.owner,
                        _request.status,
                        _request.contract,
                        _request.tx,
                    );
                    return new GetNotesResponse(_request, notes)
                } catch (error: any) {
                    return new GetNotesResponse(_request, undefined, error.message);
                }
            }
            case AccountStateServiceMethod.GetVersion: {
                const _request = request as GetVersionRequest;
                try {
                    const version = await this.getVersion(_request.networkId);
                    return new GetVersionResponse(_request, version)
                } catch (error: any) {
                    return new GetVersionResponse(_request, undefined, error.message);
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`)
                return undefined;
            }
        }
    }

    public async getAccounts(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const accounts = await this.pxeService.getRegisteredAccounts(network);
            return accounts.map(x => x.address.toString());
        }
        catch (error) {
            this.logError("Failed to fetch registered accounts", error);
            throw new Error("PXE request failed");
        }
    }

    public async getSenders(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const senders = await this.pxeService.getSenders(network);
            return senders.map(x => x.toString());
        }
        catch (error) {
            this.logError("Failed to fetch registered senders", error);
            throw new Error("PXE request failed");
        }
    }

    public async addSender(networkId: string, address: string): Promise<string> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const sender = (await this.pxeService.registerSender(network, AztecAddress.fromString(address))).toString();
            this.emit(new AccountStateServiceEventMessage(AccountStateServiceEvent.SenderAdded, sender));
            return sender;
        }
        catch (error) {
            this.logError("Failed to register sender", error);
            throw new Error("PXE request failed");
        }
    }

    public async deleteSender(networkId: string, address: string): Promise<string> {
        const network = await this.networks.getNetwork(networkId);
        try {
            await this.pxeService.removeSender(network, AztecAddress.fromString(address));
            this.emit(new AccountStateServiceEventMessage(AccountStateServiceEvent.SenderDeleted, address));
            return address;
        }
        catch (error) {
            this.logError("Failed to remove sender", error);
            throw new Error("PXE request failed");
        }
    }

    public async getContracts(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const contracts = await this.pxeService.getContracts(network);
            return contracts.map(x => x.toString());
        }
        catch (error) {
            this.logError("Failed to fetch registered contracts", error);
            throw new Error("PXE request failed");
        }
    }

    public async getNotes(
        networkId: string,
        owner: string,
        status?: NoteStatus,
        contract?: string,
        tx?: string,
    ): Promise<Note[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const notes = await this.pxeService.getNotes(network, {
                recipient: owner ? AztecAddress.fromString(owner) : undefined,
                status: status === NoteStatus.All ? _NoteStatus.ACTIVE_OR_NULLIFIED : undefined,
                contractAddress: contract ? AztecAddress.fromString(contract) : undefined,
                txHash: tx ? TxHash.fromString(tx) : undefined,
            });
            return notes.map(x => new Note(
                x.note.items.map(x => x.toString()),
                x.recipient.toString(),
                x.contractAddress.toString(),
                x.storageSlot.toString(),
                x.txHash.toString(),
                x.noteNonce.toString(),
            ));
        }
        catch (error) {
            this.logError("Failed to fetch incoming notes", error);
            throw new Error("PXE request failed");
        }
    }

    public async getVersion(networkId: string): Promise<string> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const pxeInfo = await this.pxeService.getPXEInfo(network);
            return pxeInfo.pxeVersion;
        }
        catch (error) {
            this.logError("Failed to fetch PXE info", error);
            throw new Error("PXE request failed");
        }
    }
}
