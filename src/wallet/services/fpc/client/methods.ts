import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { type FpcInfo, FPC_SERVICE_NAME, type FpcType } from ".";

export enum FpcServiceMethod {
    GetFpc,
    GetFpcs,
    AddFpc,
    UpdateFpc,
    DeleteFpc,
}

export class GetFpcsRequest extends RequestMessage {
    constructor(
        public readonly chainId?: number,
    ) {
        super(FPC_SERVICE_NAME, FpcServiceMethod.GetFpcs);
    }
}

export class GetFpcsResponse extends ResponseMessage {
    constructor(
        request: GetFpcsRequest,
        result?: FpcInfo[],
        error?: string,
    ) {
        super(FPC_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetFpcRequest extends RequestMessage {
    constructor(
        public readonly fpcId: string,
    ) {
        super(FPC_SERVICE_NAME, FpcServiceMethod.GetFpc);
    }
}

export class GetFpcResponse extends ResponseMessage {
    constructor(
        request: GetFpcRequest,
        result?: FpcInfo,
        error?: string,
    ) {
        super(FPC_SERVICE_NAME, request.requestId, result, error);
    }
}

export class AddFpcRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly fpcType: FpcType,
        public readonly fpcAddress: string,
        public readonly fpcName?: string,
    ) {
        super(FPC_SERVICE_NAME, FpcServiceMethod.AddFpc);
    }
}

export class AddFpcResponse extends ResponseMessage {
    constructor(
        request: AddFpcRequest,
        result?: FpcInfo,
        error?: string,
    ) {
        super(FPC_SERVICE_NAME, request.requestId, result, error);
    }
}

export class UpdateFpcRequest extends RequestMessage {
    constructor(
        public readonly fpcId: string,
        public readonly name: string,
    ) {
        super(FPC_SERVICE_NAME, FpcServiceMethod.UpdateFpc);
    }
}

export class UpdateFpcResponse extends ResponseMessage {
    constructor(
        request: UpdateFpcRequest,
        result?: FpcInfo,
        error?: string,
    ) {
        super(FPC_SERVICE_NAME, request.requestId, result, error);
    }
}

export class DeleteFpcRequest extends RequestMessage {
    constructor(
        public readonly fpcId: string,
    ) {
        super(FPC_SERVICE_NAME, FpcServiceMethod.DeleteFpc);
    }
}

export class DeleteFpcResponse extends ResponseMessage {
    constructor(
        request: DeleteFpcRequest,
        result?: FpcInfo,
        error?: string,
    ) {
        super(FPC_SERVICE_NAME, request.requestId, result, error);
    }
}
