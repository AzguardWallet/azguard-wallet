import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { Authwit, Note, NoteStatus } from "./models";
import {
    GetAccountsRequest,
    GetAuthwitsRequest,
    GetContactsRequest,
    GetContractsRequest,
    GetNotesRequest,
    GetVersionRequest,
} from "./methods";

export * from './methods';
export * from './models';

export const PXE_SERVICE_NAME = "pxe";

/**
 * Client for interaction with the PxeService via messaging API
 */
export class PxeServiceClient extends ServiceClient {
    /**
     * Creates PxeServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
    ) {
        super(PXE_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of registered authwits.
     * @param networkId Network id.
     * @param owner Owner account address.
     * @param isPublic Whether to return public, private or all authwits.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getAuthwits(networkId: string, owner: string, isPublic?: boolean): Promise<Authwit[]> {
        return this.request(new GetAuthwitsRequest(networkId, owner, isPublic));
    }

    /**
     * Returns a list of registered accounts.
     * @param networkId Network id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getAccounts(networkId: string): Promise<string[]> {
        return this.request(new GetAccountsRequest(networkId));
    }

    /**
     * Returns a list of registered contacts.
     * @param networkId Network id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getContacts(networkId: string): Promise<string[]> {
        return this.request(new GetContactsRequest(networkId));
    }

    /**
     * Returns a list of registered contracts.
     * @param networkId Network id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getContracts(networkId: string): Promise<string[]> {
        return this.request(new GetContractsRequest(networkId));
    }

    /**
     * Returns a list of incoming notes.
     * @param networkId Network id.
     * @param owner The owner of the note (whose public key was used to encrypt the note).
     * @param status The status of the note. Defaults to 'Active'.
     * @param contract The contract address the note belongs to.
     * @param tx Hash of a transaction from which to fetch the notes.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getNotes(networkId: string, owner: string, status?: NoteStatus, contract?: string, tx?: string): Promise<Note[]> {
        return this.request(new GetNotesRequest(networkId, owner, status, contract, tx));
    }

    /**
     * Returns PXE version.
     * @param networkId Network id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getVersion(networkId: string): Promise<string> {
        return this.request(new GetVersionRequest(networkId));
    }
}
