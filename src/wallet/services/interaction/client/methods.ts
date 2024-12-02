import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { type GetDappSessionParams, type DappSession, type InteractionRequest, INTERACTION_SERVICE_NAME } from ".";
import type { Account } from "@/wallet/services/account/client/models"
import type { WCSessionParams } from "@/wallet/services/wallet-connect/client/models"

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceMethod {
    GetDappSessions,
    GetDappSession,
    AddDappSession,
    DropDappSession,
    GetInteractionRequest,
    DeleteInteractionRequest,
}

export class GetDappSessionsRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.GetDappSessions);
    }
}

export class GetDappSessionsResponse extends ResponseMessage {
    constructor(
        request: GetDappSessionsRequest,
        result?: DappSession[],
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class GetDappSessionRequest extends RequestMessage {
    constructor(
        public readonly getDappSessionParams: GetDappSessionParams,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.GetDappSession);
    }
}

export class GetDappSessionResponse extends ResponseMessage {
    constructor(
        request: GetDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class AddDappSessionRequest extends RequestMessage {
    constructor(
        public readonly name: string,
        public readonly params: WCSessionParams,
        public readonly profileId: string,
        public readonly accounts: Array<Account>,
        public readonly url?: string,
        public readonly icon?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.AddDappSession);
    }
}

export class AddDappSessionResponse extends ResponseMessage {
    constructor(
        request: AddDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class DropDappSessionRequest extends RequestMessage {
    constructor(
        public readonly dappSessionId: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.DropDappSession);
    }
}

export class DropDappSessionResponse extends ResponseMessage {
    constructor(
        request: DropDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class GetInteractionRequestRequest extends RequestMessage {
    constructor(
        public readonly requestId: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.GetInteractionRequest);
    }
}

export class GetInteractionRequestResponse extends ResponseMessage {
    constructor(
        request: GetInteractionRequestRequest,
        result?: InteractionRequest,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class DeleteInteractionRequestRequest extends RequestMessage {
    constructor(
        public readonly requestId: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.DeleteInteractionRequest);
    }
}

export class DeleteInteractionRequestResponse extends ResponseMessage {
    constructor(
        request: DeleteInteractionRequestRequest,
        result?: boolean,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}
