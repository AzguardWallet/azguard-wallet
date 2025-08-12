import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { FeeSettings } from "@/wallet/services/execution/client";
import { Authwit, AUTH_REGISTRY_SERVICE_NAME } from ".";

export enum AuthRegistryServiceMethod {
    GetAuthwits,
    RevokeAuthwits,
    GetRegistryEnabled,
    SetRegistryEnabled,
    SyncRegistry,
}

export class GetAuthwitsRequest extends RequestMessage {
    constructor(
        public readonly account: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, AuthRegistryServiceMethod.GetAuthwits);
    }
}

export class GetAuthwitsResponse extends ResponseMessage {
    constructor(
        request: GetAuthwitsRequest,
        result?: Authwit[],
        error?: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, request.requestId, result, error);
    }
}

export class RevokeAuthwitsRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly account: string,
        public readonly ids: number[],
        public readonly feeSettings: FeeSettings,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, AuthRegistryServiceMethod.RevokeAuthwits);
    }
}

export class RevokeAuthwitsResponse extends ResponseMessage {
    constructor(
        request: RevokeAuthwitsRequest,
        error?: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, request.requestId, undefined, error);
    }
}

export class GetRegistryEnabledRequest extends RequestMessage {
    constructor(
        public readonly account: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, AuthRegistryServiceMethod.GetRegistryEnabled);
    }
}

export class GetRegistryEnabledResponse extends ResponseMessage {
    constructor(
        request: GetRegistryEnabledRequest,
        result?: boolean,
        error?: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, request.requestId, result, error);
    }
}

export class SetRegistryEnabledRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly account: string,
        public readonly enabled: boolean,
        public readonly feeSettings: FeeSettings,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, AuthRegistryServiceMethod.SetRegistryEnabled);
    }
}

export class SetRegistryEnabledResponse extends ResponseMessage {
    constructor(
        request: SetRegistryEnabledRequest,
        error?: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, request.requestId, undefined, error);
    }
}

export class SyncRegistryRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly account: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, AuthRegistryServiceMethod.SyncRegistry);
    }
}

export class SyncRegistryResponse extends ResponseMessage {
    constructor(
        request: SyncRegistryRequest,
        error?: string,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, request.requestId, undefined, error);
    }
}
