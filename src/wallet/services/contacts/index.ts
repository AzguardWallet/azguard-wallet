import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { ProfileService } from "@/wallet/services/profile";
import type { ILogs } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomElement, getRandomHex, Lock } from "@/wallet/utils";
import {
    CONTACT_SERVICE_NAME,
    type Contact,
    type GetContactsRequest,
    GetContactsResponse,
    type GetContactRequest,
    GetContactResponse,
    type AddContactRequest,
    AddContactResponse,
    type UpdateContactRequest,
    UpdateContactResponse,
    type DeleteContactRequest,
    DeleteContactResponse,
    type ExportContactRequest,
    ExportContactResponse,
    type ImportContactRequest,
    ImportContactResponse,
    ContactServiceEvent,
    ContactServiceEventMessage,
    ContactServiceMethod,
    contactColors,
} from "./client";

export class ContactService extends Service {
    public readonly onContactAdded: ((contact: Contact) => void)[] = [];
    public readonly onContactUpdated: ((contact: Contact) => void)[] = [];
    public readonly onContactDeleted: ((contact: Contact) => void)[] = [];

    private readonly storage: EntityStorage<Contact>;
    private readonly lock = new Lock();

    public constructor(
        private readonly profiles: ProfileService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {        
        super(CONTACT_SERVICE_NAME, logger, emit);
        this.storage = new EntityStorage("azguard:contacts", StorageType.Local);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case ContactServiceMethod.GetContacts: {
                const _request = request as GetContactsRequest;
                try {
                    const res = await this.getContacts();
                    return new GetContactsResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetContactsResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.GetContact: {
                const _request = request as GetContactRequest;
                try {
                    const res = await this.getContact(_request.contactId);
                    return new GetContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new GetContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.AddContact: {
                const _request = request as AddContactRequest;
                try {
                    const res = await this.addContact(
                        _request.name,
                        _request.address,
                        _request.color
                    );
                    return new AddContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new AddContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.UpdateContact: {
                const _request = request as UpdateContactRequest;
                try {
                    const res = await this.updateContact(
                        _request.contactId,
                        _request.name,
                        _request.address,
                    );

                    return new UpdateContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new UpdateContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.DeleteContact: {
                const _request = request as DeleteContactRequest;
                try {
                    const res = await this.deleteContact(_request.contactId);
                    return new DeleteContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new DeleteContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.ExportContacts: {
                const _request = request as ExportContactRequest;
                try {
                    const res = await this.exportContacts();
                    return new ExportContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new ExportContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ContactServiceMethod.ImportContacts: {
                const _request = request as ImportContactRequest;
                try {
                    const res = await this.importContacts(_request.data);
                    return new ImportContactResponse(_request, res);
                }
                catch (error: unknown) {
                    return new ImportContactResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`)
                return undefined;
            }                
        }
    }

    public async getContacts(): Promise<Contact[]> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        return (await this.storage.getValues()).filter(c => c.profileId === profile.id);
    }
    
    public async getContact(contactId: string): Promise<Contact> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        const contact = await this.storage.get(contactId);
        if (!contact) {
            throw new Error("invalid id");
        }

        return contact;
    }

    public async addContact(name: string, address: string, color?: string): Promise<Contact> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        try {
            await this.lock.enter();

            let id: string;
            do { id = getRandomHex(8); }
            while (await this.storage.contains(id));

            const contact: Contact = {
                id,
                profileId: profile.id,
                name,
                address,
                abbr: this._getAbbreviation(name),
                color: color ?? getRandomElement(contactColors)
            }

            await this.storage.set(contact.id, contact)

            this.emit(new ContactServiceEventMessage(ContactServiceEvent.ContactAdded, contact));

            return contact;
        } finally {
            this.lock.leave();
        }
    }

    public async updateContact(contactId: string, name?: string, address?: string): Promise<Contact> {
        try {
            await this.lock.enter();
                
            const contact = await this.storage.get(contactId);
            if (!contact) {
                throw new Error("Invalid id");
            }

            const newContact = {
                ...contact,
                name: name || contact.name,
                abbr: name ? this._getAbbreviation(name) : contact.abbr,
                address: address || contact.address,
            };

            await this.storage.set(contactId, newContact);

            this.emit(new ContactServiceEventMessage(ContactServiceEvent.ContactUpdated, newContact));

            return newContact;
        }
        finally {
            this.lock.leave();
        }
    }
        
    public async deleteContact(contactId: string): Promise<Contact> {
        try {
            await this.lock.enter();
               
            const contact = await this.storage.get(contactId);
            if (!contact) {
                throw new Error("Invalid id");
            }

            this.logDebug(`Remove contact #${contact.id} - ${contact.name}`);
            await this.storage.delete(contactId);
            
            this.emit(new ContactServiceEventMessage(ContactServiceEvent.ContactDeleted, contact));

            return contact;
        }
        finally {
            this.lock.leave();
        }
    }

    public async exportContacts(): Promise<string> {
        const contacts = await this.getContacts();
        const data = contacts.map(contact => ({
            name: contact.name,
            address: contact.address,
            color: contact.color
        }));

        return JSON.stringify(data, null, 2);
    }

    public async importContacts(data: string): Promise<Contact[]> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        const importedContacts = JSON.parse(data);
        const results: Contact[] = [];
        
        // const existingContacts  = (await this.storage.getValues()).filter(c => c.profileId === profile.id);
        // const contactsByAddress = new Map<string, Contact>();
        // const contactsByName = new Map<string, Contact>();
        
        // existingContacts.forEach(contact => {
        //     contactsByAddress.set(contact.address, contact);
        //     contactsByName.set(contact.name, contact);
        // });

        // for (const _c of importedContacts) {
        //     try {
        //         let contact: Contact;

        //         const existingByAddress = contactsByAddress.get(_c.address);
        //         const existingByName = contactsByName.get(_c.name);

        //         if (existingByAddress) {
        //             contact = await this.updateContact(
        //                 existingByAddress.id,
        //                 _c.name,
        //                 _c.address
        //             );
                    
        //             // this.logDebug(`Updated existing contact by address: ${importedContact.address}`);
        //         } else if (existingByName) {
        //             // Если контакт с таким именем уже существует - обновляем его
        //             contact = await this.updateContact(
        //                 existingByName.id,
        //                 importedContact.name,
        //                 importedContact.address
        //             );
                    
        //             this.logDebug(`Updated existing contact by name: ${importedContact.name}`);
        //         } else {
        //             // Создаем новый контакт
        //             contact = await this.addContact(
        //                 importedContact.name,
        //                 importedContact.address,
        //                 importedContact.color || this._getRandomColor()
        //             );
                    
        //             this.logDebug(`Added new contact: ${importedContact.name}`);
        //         }

        //         if (addresses.includes(_c.address)) {
        //             const _contact = contacts.find(c => c.address === _c.address);
        //             await this.storage.set(contactId, newContact);
        //         } else if (names.includes(_c.name)) {
        //             contact = contacts.find(c => c.name === _c.name);
        //         } else {
        //             contact = await this.addContact(
        //                 _c.name,
        //                 _c.address,
        //                 contactColors.includes(_c.color)
        //                     ? _c.color
        //                     : null
        //             );
        //         }

        //         results.push(contact!);
        //     } catch (error) {
        //         this.logError(`Failed to import contact ${_c.name}: ${error}`);
        //     }
        // }
        
        return results;
    }

    private readonly onProfileDeleted = async (profileId: string) => {
        this.logDebug(`Profile ${profileId} deleted, remove related contacts`);
        try {
            await this.lock.enter();
            const contacts = (await this.storage.getValues()).filter(c => c.profileId === profileId);
            for (const contact of contacts) {
                this.logDebug(`Remove contact #${contact.id} - ${contact.name}`);

                await this.storage.delete(contact.id);
                this.emit(new ContactServiceEventMessage(ContactServiceEvent.ContactDeleted, contact));
            }
        } finally {
            this.lock.leave();
        }
    }
    
    private _getAbbreviation(name: string): string {
        const words = name.trim().split(/\s+/);

        if (words.length > 1) {
            return (words[0][0] + words[1][0]).toUpperCase();
        }
        
        if (words.length === 1) {
            return words[0].substring(0, Math.min(words[0].length, 2)).toUpperCase();
        }

        return "AZ";
    }
}
