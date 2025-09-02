import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { getRandomHex, getRandomElement, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { getErrorMessage } from "@/wallet/utils/errors";
import { Contact, CONTACT_SERVICE_NAME, contactColors, Events, Methods } from "./spec";

export * from "./spec";

export class ContactService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = CONTACT_SERVICE_NAME;

    public readonly onContactAdded = new EventHandler<Contact>();
    public readonly onContactUpdated = new EventHandler<Contact>();
    public readonly onContactDeleted = new EventHandler<Contact>();

    private readonly storage = new EntityStorage<Contact>("azguard:core:contacts", StorageType.Local);
    private readonly lock = new Lock();

    private profileService: ProfileService = null!;

    public constructor(logger: ILogger) {
        super(CONTACT_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.profileService.onProfileDeleted.add(this.onProfileDeleted);
    }

    public async getContacts(): Promise<Contact[]> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        return (await this.storage.getValues()).filter(c => c.profileId === profile.id);
    }
    
    public async getContact(contactId: string): Promise<Contact> {
        const profile = await this.profileService.getActiveProfile();
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
        const profile = await this.profileService.getActiveProfile();
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

            this.emit("onContactAdded", contact);

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

            this.emit("onContactUpdated", newContact);

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
            
            this.emit("onContactDeleted", contact);

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
        const profile = await this.profileService.getActiveProfile();
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
        //         this.logError(`Failed to import contact ${_c.name}`, getErrorMessage(error));
        //     }
        // }
        
        return results;
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`Profile ${profile.id} deleted, remove related contacts`);
        try {
            await this.lock.enter();
            const contacts = (await this.storage.getValues()).filter(c => c.profileId === profile.id);
            for (const contact of contacts) {
                this.logDebug(`Remove contact #${contact.id} - ${contact.name}`);

                await this.storage.delete(contact.id);
                this.emit("onContactDeleted", contact);
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
