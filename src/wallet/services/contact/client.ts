import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Contact, CONTACT_SERVICE_NAME, type Events, type Methods } from "./spec"

export * from "./spec"

export class ContactServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onContactAdded = new EventHandler<Contact>()
	public readonly onContactUpdated = new EventHandler<Contact>()
	public readonly onContactDeleted = new EventHandler<Contact>()

	public constructor(name?: string) {
		super(CONTACT_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getContacts(): Promise<Contact[]> {
		return this.request("getContacts")
	}

	public getContact(id: string): Promise<Contact> {
		return this.request("getContact", id)
	}

	public getContactByAddress(address: string): Promise<Contact | undefined> {
		return this.request("getContactByAddress", address)
	}

	public addContact(name: string, address: string, color?: string): Promise<Contact> {
		return this.request("addContact", name, address, color)
	}

	public updateContact(id: string, name?: string, address?: string): Promise<Contact> {
		return this.request("updateContact", id, name, address)
	}

	public deleteContact(id: string): Promise<Contact> {
		return this.request("deleteContact", id)
	}

	public exportContacts(): Promise<string> {
		return this.request("exportContacts")
	}

	public importContacts(data: string): Promise<Contact[]> {
		return this.request("importContacts", data)
	}
}
