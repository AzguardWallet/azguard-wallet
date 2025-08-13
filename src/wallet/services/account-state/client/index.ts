import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { AccountStateServiceEvent, type AccountStateServiceEventMessage } from "./events";
import type { Authwit, Note, NoteStatus } from "./models";
import {
    GetAccountsRequest,
    GetAuthwitsRequest,
    GetSendersRequest,
    AddSenderRequest,
    DeleteSenderRequest,
    GetContractsRequest,
    GetNotesRequest,
    GetVersionRequest,
} from "./methods";

export * from "./events";
export * from './methods';
export * from './models';

export const ACCOUNT_STATE_SERVICE_NAME = "account-state";

/**
 * Client for interaction with the AccountStateService via messaging API
 */
export class AccountStateServiceClient extends ServiceClient {
    /**
     * Creates AccountStateServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onSenderAdded Callback, called when a new sender was added.
     * @param onSenderDeleted Callback, called when an existing sender was deleted.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onSenderAdded?: (sender: string) => void,
        private readonly onSenderDeleted?: (sender: string) => void,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, new LoggerServiceClient(), onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case AccountStateServiceEvent.SenderAdded:
                if (this.onSenderAdded) {
                    try {
                        this.onSenderAdded((message as AccountStateServiceEventMessage).sender);
                    } catch {}
                }
                break;
            case AccountStateServiceEvent.SenderDeleted:
                if (this.onSenderDeleted) {
                    try {
                        this.onSenderDeleted((message as AccountStateServiceEventMessage).sender);
                    } catch {}
                }
                break;
            default:
                this.logError(`Unexpected event type ${message.event}.`);
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
     * Returns a list of registered senders.
     * @param networkId Network id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public getSenders(networkId: string): Promise<string[]> {
        return this.request(new GetSendersRequest(networkId));
    }

    /**
     * Adds a sender.
     * @param networkId Network id.
     * @param address Sender address.
     * @emits `SenderAdded` event.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public addSender(networkId: string, address: string): Promise<string> {
        return this.request(new AddSenderRequest(networkId, address));
    }

    /**
     * Deletes a sender.
     * @param networkId Network id.
     * @param address Sender address.
     * @emits `SenderDeleted` event.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the network with the specified id doesn't exist within the active profile.
     * @throws "PXE request failed" if request failed.
     */
    public deleteSender(networkId: string, address: string): Promise<string> {
        return this.request(new DeleteSenderRequest(networkId, address));
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
