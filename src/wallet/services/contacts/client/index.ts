import { ServiceClient } from "@/wallet/base/port-service/service-client";
import type { EventMessage } from "@/wallet/base/port-service/messages";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import type { Contact } from "./models";
import {
	ContactServiceEvent,
	type ContactServiceEventMessage,
} from "./events";
import {
	GetContactsRequest,
	AddContactRequest,
	UpdateContactRequest,
	DeleteContactRequest,
    ExportContactRequest,
    ImportContactRequest,
} from "./methods";

export * from "./events";
export * from "./methods";
export * from "./models";

export const CONTACT_SERVICE_NAME = "contacts";

/**
 * Client for interaction with the ContactService via messaging API
 */
export class ContactServiceClient extends ServiceClient {
    /**
     * Creates ContactgServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onContactAdded Callback, called when a new contact was added.
     * @param onContactUpdated Callback, called when an existing contact was updated.
     * @param onContactDeleted Callback, called when an existing contact was deleted.
     */
	constructor(
		onConnected?: () => void,
		onDisconnected?: () => void,
		private readonly onContactAdded?: (contact: Contact) => void,
		private readonly onContactUpdated?: (contact: Contact) => void,
		private readonly onContactDeleted?: (contact: Contact) => void
	) {
		super(CONTACT_SERVICE_NAME, new LoggerServiceClient, onConnected, onDisconnected);
	}

	protected onEvent(message: EventMessage): void {
		switch (message.event) {
			case ContactServiceEvent.ContactAdded:
                if (this.onContactAdded) {
                    try {
                        this.onContactAdded((message as ContactServiceEventMessage).contact);
                    }
                    catch {}
                }
                break;
			case ContactServiceEvent.ContactUpdated:
                if (this.onContactUpdated) {
                    try {
                        this.onContactUpdated((message as ContactServiceEventMessage).contact);
                    }
                    catch {}
                }
                break;
			case ContactServiceEvent.ContactDeleted:
                if (this.onContactDeleted) {
                    try {
                        this.onContactDeleted((message as ContactServiceEventMessage).contact);
                    }
                    catch {}
                }
                break;
			default:
				this.logError(`Unexpected event type ${message.event}.`);
		}
	}

    /**
     * Returns a list of contacts.
     */
	public getContacts(): Promise<Contact[]> {
		return this.request(new GetContactsRequest());
	}

    /**
     * Adds a new contact.
     * @param name contact name.
     * @param address contact address.
     * @param color contact color coding.
     * @emits `ContactAdded` event.
     */
	public addContact(name: string, address: string, color?: string): Promise<Contact> {
		return this.request(new AddContactRequest(name, address, color));
	}

    /**
     * Updates an existing contact.
     * @param contact existing contact entity.
     * @emits `ContactUpdated` event.
     */
	public updateContact(
        contactId: string,
        args: { name: string; address?: string } | { name?: string; address: string }
    ): Promise<Contact> {
		return this.request(new UpdateContactRequest(contactId, args.name, args.address));
	}

    /**
     * Deletes an existing contact.
     * @param id existing contact id.
     * @emits `ContactDeleted` event.
     */
	public deleteContact(id: string): Promise<Contact> {
		return this.request(new DeleteContactRequest(id));
	}

    /**
     * Export contacts to JSON.
     */
	public exportContacts(): Promise<string> {
		return this.request(new ExportContactRequest());
	}

    /**
     * Deletes an existing contact.
     * @param id existing contact id.
     * @emits `ContactDeleted` event.
     */
	public importContacts(data: string): Promise<Contact[]> {
		return this.request(new ImportContactRequest(data));
	}
}
