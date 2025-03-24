import { createPXEClient } from "@aztec/aztec.js";
import { Fr } from "@aztec/foundation/fields";
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { PXE } from '@aztec/stdlib/interfaces/client';
import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import { TxHash } from "@aztec/stdlib/tx";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { NetworkService } from "@/wallet/services/network";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { isPublicAuthwitConsumable } from "@/wallet/utils/auth-registry";
import {
    Authwit,
    GetAccountsRequest,
    GetAccountsResponse,
    GetAuthwitsRequest,
    GetAuthwitsResponse,
    GetContactsRequest,
    GetContactsResponse,
    GetContractsRequest,
    GetContractsResponse,
    GetNotesRequest,
    GetNotesResponse,
    GetVersionRequest,
    GetVersionResponse,
    Note,
    NoteStatus,
    PXE_SERVICE_NAME,
    PxeServiceMethod,
} from "./client";

export class PxeService extends Service {
    private readonly authwits: EntityStorage<Authwit>;

    constructor(
        private readonly networks: NetworkService,
        emit: (event: EventMessage) => void
    ) {
        super(PXE_SERVICE_NAME, emit);
        this.authwits = new EntityStorage("azguard:core:authwits", StorageType.Local);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case PxeServiceMethod.GetAuthwits: {
                const _request = request as GetAuthwitsRequest;
                try {
                    const authwits = await this.getAuthwits(_request.networkId, _request.owner, _request.isPublic);
                    return new GetAuthwitsResponse(_request, authwits)
                } catch (error: any) {
                    return new GetAuthwitsResponse(_request, undefined, error.message);
                }
            }
            case PxeServiceMethod.GetAccounts: {
                const _request = request as GetAccountsRequest;
                try {
                    const accounts = await this.getAccounts(_request.networkId);
                    return new GetAccountsResponse(_request, accounts)
                } catch (error: any) {
                    return new GetAccountsResponse(_request, undefined, error.message);
                }
            }
            case PxeServiceMethod.GetContacts: {
                const _request = request as GetContactsRequest;
                try {
                    const contacts = await this.getContacts(_request.networkId);
                    return new GetContactsResponse(_request, contacts)
                } catch (error: any) {
                    return new GetContactsResponse(_request, undefined, error.message);
                }
            }
            case PxeServiceMethod.GetContracts: {
                const _request = request as GetContractsRequest;
                try {
                    const contracts = await this.getContracts(_request.networkId);
                    return new GetContractsResponse(_request, contracts)
                } catch (error: any) {
                    return new GetContractsResponse(_request, undefined, error.message);
                }
            }
            case PxeServiceMethod.GetNotes: {
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
            case PxeServiceMethod.GetVersion: {
                const _request = request as GetVersionRequest;
                try {
                    const version = await this.getVersion(_request.networkId);
                    return new GetVersionResponse(_request, version)
                } catch (error: any) {
                    return new GetVersionResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async addAuthwit(
        owner: string,
        hash: string,
        isPublic: boolean,
    ) {
        await this.authwits.set(`${hash}:${isPublic}`, {
            owner,
            hash,
            content: undefined,
            isPublic,
        })
    }

    public async addCallAuthwit(
        owner: string,
        hash: string,
        caller: string,
        contract: string,
        method: string,
        args: any[],
        isPublic: boolean,
    ) {
        await this.authwits.set(`${hash}:${isPublic}`, {
            owner,
            hash,
            content: { caller, contract, method, args },
            isPublic,
        })
    }

    public async addIntentAuthwit(
        owner: string,
        hash: string,
        consumer: string,
        intent: string[],
        isPublic: boolean,
    ) {
        await this.authwits.set(`${hash}:${isPublic}`, {
            owner,
            hash,
            content: { consumer, intent },
            isPublic,
        })
    }

    public async getAuthwits(networkId: string, owner: string, isPublic?: boolean): Promise<Authwit[]> {
        await this.syncAuthwits(networkId, owner);
        return (await this.authwits.getValues())
            .filter(x => x.owner === owner && (isPublic === undefined || x.isPublic === isPublic));
    }

    public async getAccounts(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const pxe = createPXEClient(network.rpcUrl);
            return (await pxe.getRegisteredAccounts()).map(x => x.address.toString());
        }
        catch (error) {
            console.error("Failed to fetch registered accounts", error);
            throw new Error("PXE request failed");
        }
    }

    public async getContacts(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const pxe = createPXEClient(network.rpcUrl);
            return (await pxe.getSenders()).map(x => x.toString());
        }
        catch (error) {
            console.error("Failed to fetch registered senders", error);
            throw new Error("PXE request failed");
        }
    }

    public async getContracts(networkId: string): Promise<string[]> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const pxe = createPXEClient(network.rpcUrl);
            return (await pxe.getContracts()).map(x => x.toString());
        }
        catch (error) {
            console.error("Failed to fetch registered contracts", error);
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
            const pxe = createPXEClient(network.rpcUrl);
            const notes = await pxe.getNotes({
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
                x.nonce.toString(),
            ));
        }
        catch (error) {
            console.error("Failed to fetch incoming notes", error);
            throw new Error("PXE request failed");
        }
    }

    public async getVersion(networkId: string): Promise<string> {
        const network = await this.networks.getNetwork(networkId);
        try {
            const pxe = createPXEClient(network.rpcUrl);
            return (await pxe.getPXEInfo()).pxeVersion;
        }
        catch (error) {
            console.error("Failed to fetch PXE info", error);
            throw new Error("PXE request failed");
        }
    }

    private async syncAuthwits(networkId: string, owner: string) {
        const network = await this.networks.getNetwork(networkId);
        const pxe = createPXEClient(network.rpcUrl);
        const active = (await this.authwits.getValues()).filter(x => x.owner === owner);
        await Promise.allSettled(
            active.map(x => x.isPublic ? this.syncPublicAuthwit(pxe, x) : this.syncPrivateAuthwit(pxe, x))
        );
    }

    private async syncPrivateAuthwit(pxe: PXE, authwit: Authwit) {
        // TODO: Check nullifiers
        const res = await pxe.getAuthWitness(Fr.fromString(authwit.hash)); // TODO: Fr.fromHexString
        if (!res || res.length === 0) {
            await this.authwits.delete(`${authwit.hash}:${authwit.isPublic}`);
        }
    }

    private async syncPublicAuthwit(pxe: PXE, authwit: Authwit) {
        if (!await isPublicAuthwitConsumable(pxe, authwit.owner, authwit.hash)) {
            await this.authwits.delete(`${authwit.hash}:${authwit.isPublic}`);
        }
    }
}
