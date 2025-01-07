import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import {
    type GetDappSessionParams,
    type DappMetadata,
    type DappSession,
    type InteractionRequest,
    INTERACTION_SERVICE_NAME,
    type Namespaces,
} from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceMethod {
    GetDappSessions,
    GetDappSession,
    BuildApprovedNamespaces,
    AddDappSession,
    DropDappSession,
    GetInteractionRequest,
    GetInteractionPromise,
    ApproveInteractionRequest,
    RejectInteractionRequest,
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
        public readonly sessionId: string,
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

export class BuildApprovedNamespacesRequest extends RequestMessage {
    constructor(
        public readonly requiredNamespaces: Namespaces,
        public readonly supportedNamespaces: Namespaces,
        public readonly optionaldNamespaces?: Namespaces,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.BuildApprovedNamespaces);
    }
}

export class BuildApprovedNamespacesResponse extends ResponseMessage {
    constructor(
        request: BuildApprovedNamespacesRequest,
        result?: Namespaces,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class AddDappSessionRequest extends RequestMessage {
    constructor(
        public readonly dappMetadata: DappMetadata,
        public readonly namespaces: Namespaces,
        public readonly expiry: number,
        public readonly profileId: string,
        public readonly topic?: string,
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
        public readonly sessionId: string,
        public readonly emit?: boolean,
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

export class ApproveInteractionRequestRequest extends RequestMessage {
    constructor(
        public readonly requestId: string,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly result?: any,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.ApproveInteractionRequest);
    }
}

export class ApproveInteractionRequestResponse extends ResponseMessage {
    constructor(
        request: ApproveInteractionRequestRequest,
        result?: InteractionRequest,
        error?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class RejectInteractionRequestRequest extends RequestMessage {
    constructor(
        public readonly requestId: string,
        public readonly reason?: string,
    ) {
        super(INTERACTION_SERVICE_NAME, InteractionServiceMethod.RejectInteractionRequest);
    }
}

export class RejectInteractionRequestResponse extends ResponseMessage {
    constructor(
        request: RejectInteractionRequestRequest,
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
