import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Network, NETWORK_SERVICE_NAME, NodeStatus } from ".";

export enum NetworkServiceMethod {
    GetOrInitNetworks,
    GetNetworks,
    GetNetwork,
    AddNetwork,
    UpdateNetwork,
    DeleteNetwork,
    SetDefault,
    GetNodeStatus,
}

export class GetOrInitNetworksRequest extends RequestMessage {
    constructor() {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.GetOrInitNetworks);
    }
}

export class GetOrInitNetworksResponse extends ResponseMessage {
    constructor(
        request: GetOrInitNetworksRequest,
        result?: Network[],
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetNetworksRequest extends RequestMessage {
    constructor(
        public readonly chainId?: number,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.GetNetworks);
    }
}

export class GetNetworksResponse extends ResponseMessage {
    constructor(
        request: GetNetworksRequest,
        result?: Network[],
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetNetworkRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.GetNetwork);
    }
}

export class GetNetworkResponse extends ResponseMessage {
    constructor(
        request: GetNetworkRequest,
        result?: Network,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class AddNetworkRequest extends RequestMessage {
    constructor(
        public readonly rpcUrl: string,
        public readonly name: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.AddNetwork);
    }
}

export class AddNetworkResponse extends ResponseMessage {
    constructor(
        request: AddNetworkRequest,
        result?: Network,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class UpdateNetworkRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly rpcUrl: string,
        public readonly name: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.UpdateNetwork);
    }
}

export class UpdateNetworkResponse extends ResponseMessage {
    constructor(
        request: UpdateNetworkRequest,
        result?: Network,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class DeleteNetworkRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.DeleteNetwork);
    }
}

export class DeleteNetworkResponse extends ResponseMessage {
    constructor(
        request: DeleteNetworkRequest,
        result?: Network,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class SetDefaultRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.SetDefault);
    }
}

export class SetDefaultResponse extends ResponseMessage {
    constructor(
        request: SetDefaultRequest,
        result?: Network,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetNodeStatusRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
    ) {
        super(NETWORK_SERVICE_NAME, NetworkServiceMethod.GetNodeStatus);
    }
}

export class GetNodeStatusResponse extends ResponseMessage {
    constructor(
        request: GetNodeStatusRequest,
        result?: NodeStatus,
        error?: string,
    ) {
        super(NETWORK_SERVICE_NAME, request.requestId, result, error);
    }
}