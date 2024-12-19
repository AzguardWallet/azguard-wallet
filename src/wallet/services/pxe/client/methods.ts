import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Authwit, Note, NoteStatus, PXE_SERVICE_NAME } from ".";

export enum PxeServiceMethod {
    GetAuthwits,
    GetAccounts,
    GetContacts,
    GetContracts,
    GetNotes,
    GetVersion,
}

export class GetAuthwitsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly owner: string,
        public readonly isPublic?: boolean,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetAuthwits);
    }
}

export class GetAuthwitsResponse extends ResponseMessage {
    constructor(
        request: GetAuthwitsRequest,
        result?: Authwit[],
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetAccountsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetAccounts);
    }
}

export class GetAccountsResponse extends ResponseMessage {
    constructor(
        request: GetAccountsRequest,
        result?: string[],
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetContactsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetContacts);
    }
}

export class GetContactsResponse extends ResponseMessage {
    constructor(
        request: GetContactsRequest,
        result?: string[],
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetContractsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetContracts);
    }
}

export class GetContractsResponse extends ResponseMessage {
    constructor(
        request: GetContractsRequest,
        result?: string[],
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetNotesRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly owner: string,
        public readonly status?: NoteStatus,
        public readonly contract?: string,
        public readonly tx?: string,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetNotes);
    }
}

export class GetNotesResponse extends ResponseMessage {
    constructor(
        request: GetNotesRequest,
        result?: Note[],
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}

export class GetVersionRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(PXE_SERVICE_NAME, PxeServiceMethod.GetVersion);
    }
}

export class GetVersionResponse extends ResponseMessage {
    constructor(
        request: GetVersionRequest,
        result?: string,
        error?: string,
    ) {
        super(PXE_SERVICE_NAME, request.id, result, error);
    }
}
