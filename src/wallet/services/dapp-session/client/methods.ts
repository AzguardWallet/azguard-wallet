import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import {
    DappMetadata,
    DappPermissions,
    DappSession,
    DAPP_SESSION_SERVICE_NAME,
} from ".";

export enum DappSessionServiceMethod {
    GetDappSessions,
    GetDappSession,
    AddDappSession,
    UpdateDappSession,
    DeleteDappSession,
}

export class GetDappSessionsRequest extends RequestMessage {
    constructor() {
        super(DAPP_SESSION_SERVICE_NAME, DappSessionServiceMethod.GetDappSessions);
    }
}

export class GetDappSessionsResponse extends ResponseMessage {
    constructor(
        request: GetDappSessionsRequest,
        result?: DappSession[],
        error?: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetDappSessionRequest extends RequestMessage {
    constructor(
        public readonly sessionId: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, DappSessionServiceMethod.GetDappSession);
    }
}

export class GetDappSessionResponse extends ResponseMessage {
    constructor(
        request: GetDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, request.requestId, result, error);
    }
}

export class AddDappSessionRequest extends RequestMessage {
    constructor(
        public readonly dappMetadata: DappMetadata,
        public readonly permissions: DappPermissions[],
        public readonly accounts: string[],
    ) {
        super(DAPP_SESSION_SERVICE_NAME, DappSessionServiceMethod.AddDappSession);
    }
}

export class AddDappSessionResponse extends ResponseMessage {
    constructor(
        request: AddDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, request.requestId, result, error);
    }
}

export class UpdateDappSessionRequest extends RequestMessage {
    constructor(
        public readonly sessionId: string,
        public readonly permissions: DappPermissions[],
        public readonly accounts: string[],
    ) {
        super(DAPP_SESSION_SERVICE_NAME, DappSessionServiceMethod.UpdateDappSession);
    }
}

export class UpdateDappSessionResponse extends ResponseMessage {
    constructor(
        request: UpdateDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, request.requestId, result, error);
    }
}

export class DeleteDappSessionRequest extends RequestMessage {
    constructor(
        public readonly sessionId: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, DappSessionServiceMethod.DeleteDappSession);
    }
}

export class DeleteDappSessionResponse extends ResponseMessage {
    constructor(
        request: DeleteDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, request.requestId, result, error);
    }
}