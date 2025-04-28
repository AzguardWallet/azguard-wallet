import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Authwit, Note, NoteStatus, ACCOUNT_STATE_SERVICE_NAME } from ".";

export enum AccountStateServiceMethod {
    GetAuthwits,
    GetAccounts,
    GetSenders,
    AddSender,
    DeleteSender,
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
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetAuthwits);
    }
}

export class GetAuthwitsResponse extends ResponseMessage {
    constructor(
        request: GetAuthwitsRequest,
        result?: Authwit[],
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetAccountsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetAccounts);
    }
}

export class GetAccountsResponse extends ResponseMessage {
    constructor(
        request: GetAccountsRequest,
        result?: string[],
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetSendersRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetSenders);
    }
}

export class GetSendersResponse extends ResponseMessage {
    constructor(
        request: GetSendersRequest,
        result?: string[],
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class AddSenderRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly address: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.AddSender);
    }
}

export class AddSenderResponse extends ResponseMessage {
    constructor(
        request: AddSenderRequest,
        result?: string,
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class DeleteSenderRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly address: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.DeleteSender);
    }
}

export class DeleteSenderResponse extends ResponseMessage {
    constructor(
        request: DeleteSenderRequest,
        result?: string,
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetContractsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetContracts);
    }
}

export class GetContractsResponse extends ResponseMessage {
    constructor(
        request: GetContractsRequest,
        result?: string[],
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
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
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetNotes);
    }
}

export class GetNotesResponse extends ResponseMessage {
    constructor(
        request: GetNotesRequest,
        result?: Note[],
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetVersionRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, AccountStateServiceMethod.GetVersion);
    }
}

export class GetVersionResponse extends ResponseMessage {
    constructor(
        request: GetVersionRequest,
        result?: string,
        error?: string,
    ) {
        super(ACCOUNT_STATE_SERVICE_NAME, request.requestId, result, error);
    }
}
