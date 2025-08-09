import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages"
import { type Contact, CONTACT_SERVICE_NAME } from "."

export enum ContactServiceMethod {
	GetContacts,
	GetContact,
    AddContact,
	UpdateContact,
	DeleteContact,
	ExportContacts,
	ImportContacts,
}

// Get all contacts
export class GetContactsRequest extends RequestMessage {
	constructor() {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.GetContacts)
	}
}

export class GetContactsResponse extends ResponseMessage {
	constructor(
		request: GetContactsRequest,
		result?: Contact[],
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}

// Get single contact by address
export class GetContactRequest extends RequestMessage {
	constructor(
        public readonly contactId: string
    ) {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.GetContact)
	}
}

export class GetContactResponse extends ResponseMessage {
	constructor(
		request: GetContactRequest,
		result?: Contact,
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}

// Add a contact
export class AddContactRequest extends RequestMessage {
    constructor(
        public readonly name: string,
        public readonly address: string,
		public readonly color?: string,
    ) {
        super(CONTACT_SERVICE_NAME, ContactServiceMethod.AddContact);
    }
}

export class AddContactResponse extends ResponseMessage {
    constructor(
        request: AddContactRequest,
        result?: Contact,
        error?: string,
    ) {
        super(CONTACT_SERVICE_NAME, request.requestId, result, error);
    }
}

// Update a contact
export class UpdateContactRequest extends RequestMessage {
	constructor(
        public readonly contactId: string,
        public readonly name?: string,
        public readonly address?: string,
    ) {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.UpdateContact)
	}
}

export class UpdateContactResponse extends ResponseMessage {
	constructor(
		request: UpdateContactRequest,
        result?: Contact,
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}

// Delete contact by address
export class DeleteContactRequest extends RequestMessage {
	constructor(
        public readonly contactId: string
    ) {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.DeleteContact)
	}
}

export class DeleteContactResponse extends ResponseMessage {
	constructor(
		request: DeleteContactRequest,
        result?: Contact,
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}

// Export contacts
export class ExportContactRequest extends RequestMessage {
	constructor() {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.ExportContacts)
	}
}

export class ExportContactResponse extends ResponseMessage {
	constructor(
		request: ExportContactRequest,
        result?: string,
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}

// Import contacts
export class ImportContactRequest extends RequestMessage {
	constructor(
        public readonly data: string
    ) {
		super(CONTACT_SERVICE_NAME, ContactServiceMethod.DeleteContact)
	}
}

export class ImportContactResponse extends ResponseMessage {
	constructor(
		request: ImportContactRequest,
        result?: Contact[],
		error?: string
	) {
		super(CONTACT_SERVICE_NAME, request.requestId, result, error)
	}
}
