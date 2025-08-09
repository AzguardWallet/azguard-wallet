import { EventMessage } from "@/wallet/base/port-service/messages";
import { Contact, CONTACT_SERVICE_NAME } from ".";

export enum ContactServiceEvent {
    ContactAdded,
    ContactUpdated,
    ContactDeleted,
}

export class ContactServiceEventMessage extends EventMessage {
    constructor(
        event: ContactServiceEvent,
        public readonly contact: Contact,
    ) {
        super(CONTACT_SERVICE_NAME, event);
    }
}
