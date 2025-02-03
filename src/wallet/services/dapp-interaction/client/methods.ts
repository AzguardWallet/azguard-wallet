import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import {
    ConnectionPayload,
    ConnectionResult,
    ExecutionPayload,
    ExecutionResult,
    DAPP_INTERACTION_SERVICE_NAME,
} from ".";

export enum DappInteractionServiceMethod {
    GetInteractionPayload,
    ResolveInteraction,
    RejectInteraction,
}

export class GetInteractionPayloadRequest extends RequestMessage {
    constructor(
        public readonly interactionId: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, DappInteractionServiceMethod.GetInteractionPayload);
    }
}

export class GetInteractionPayloadResponse extends ResponseMessage {
    constructor(
        request: GetInteractionPayloadRequest,
        result?: ConnectionPayload | ExecutionPayload,
        error?: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, request.id, result, error);
    }
}

export class ResolveInteractionRequest extends RequestMessage {
    constructor(
        public readonly interactionId: string,
        public readonly result: ConnectionResult | ExecutionResult,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, DappInteractionServiceMethod.ResolveInteraction);
    }
}

export class ResolveInteractionResponse extends ResponseMessage {
    constructor(
        request: ResolveInteractionRequest,
        error?: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, request.id, undefined, error);
    }
}

export class RejectInteractionRequest extends RequestMessage {
    constructor(
        public readonly interactionId: string,
        public readonly reason: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, DappInteractionServiceMethod.RejectInteraction);
    }
}

export class RejectInteractionResponse extends ResponseMessage {
    constructor(
        request: RejectInteractionRequest,
        error?: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, request.id, undefined, error);
    }
}