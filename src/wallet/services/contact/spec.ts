export const CONTACT_SERVICE_NAME = "contact";

export const contactColors = ["blue", "green", "mint", "neutral-mint", "orange", "yellow", "red", "purple", "gray", "sand"]

export class Contact {
	/**
	 * Creates Contact.
	 * @param id Randomly generated contact id.
     * @param profileId Profile id.
	 * @param name Contact name.
	 * @param address Contact address.
	 * @param abbr Contact name abbreviation (1–2 letters).
	 * @param color Contact abbr color.
	 */
	constructor(
		public readonly id: string,
        public readonly profileId: string,
		public readonly name: string,
		public readonly address: string,
		public readonly abbr: string,
		public readonly color: string,
	) {}
}

// export enum NodeStatus {
//     Active,
//     Inactive,
//     InvalidChain,
// }

// export type Network = {
//     /** Randomly generated id. */
//     id: string;
//     /** Profile id. */
//     profileId: string;
//     /** Display name. */
//     name: string;
//     /** RPC URL. */
//     rpcUrl: string;
//     /** Chain id, automatically determined from the RPC. */
//     chainId: number;
//     /** Whether or not this node is default for the given chain */
//     isDefault: boolean;
// };

export type Methods = {
    /**
     * Returns a list of contacts.
     */
    getContacts(): Contact[];

    /**
     * Returns a contact with the specified id.
     * @param id Contact id.
     */
    getContact(id: string): Contact;

    /**
     * Creates and returns a new contact.
     * @param name Display name.
     * @param address contact address.
     * @param color Contact color.
     */
    addContact(name: string, address: string, color?: string): Contact;

    /**
     * Changes contact name and address and returns the updated contact.
     * @param id Contact id.
     * @param name New contact name.
     * @param address New contact address.
     */
    updateContact(id: string, name?: string, address?: string): Contact;

    /**
     * Deletes contact with the specified id.
     * @param id Contact id.
     */
    deleteContact(id: string): Contact;

    /**
     * Export all existing contacts to json.
     */
    exportContacts(): string;

    /**
     * Import contacts from JSON.
     * @param data Contact list in JSON format.
     */
    importContacts(data: string): Contact[];
};

export type Events = {
    /** Emitted when a new contact is added */
    onContactAdded: Contact;
    /** Emitted when an existing contact is updated */
    onContactUpdated: Contact;
    /** Emitted when an existing contact is deleted */
    onContactDeleted: Contact;
};
