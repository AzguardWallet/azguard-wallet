import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Note, NOTE_SERVICE_NAME } from ".";

export enum NoteServiceMethod {
    GetNotes,
}

export class GetNotesRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly account: string,
        public readonly contract?: string,
    ) {
        super(NOTE_SERVICE_NAME, NoteServiceMethod.GetNotes);
    }
}

export class GetNotesResponse extends ResponseMessage {
    constructor(
        request: GetNotesRequest,
        result?: Note[],
        error?: string,
    ) {
        super(NOTE_SERVICE_NAME, request.requestId, result, error);
    }
}
