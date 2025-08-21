import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import type { Note } from "./models";
import { GetNotesRequest } from "./methods";

export * from "./methods";
export * from "./models";

export const NOTE_SERVICE_NAME = "note";

/**
 * Client for interaction with the NoteService via messaging API
 */
export class NoteServiceClient extends ServiceClient {
    /**
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(onConnected?: () => void, onDisconnected?: () => void) {
        super(NOTE_SERVICE_NAME, new LoggerServiceClient(), onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        this.logError(`Unexpected event type ${message.event}.`);
    }

    /**
     * Returns a list of private notes.
     * @param networkId Network id.
     * @param account Account address.
     * @param contract Contract address the note belongs to.
     */
    public getNotes(networkId: string, account: string, contract?: string): Promise<Note[]> {
        return this.request(new GetNotesRequest(networkId, account, contract));
    }
}
