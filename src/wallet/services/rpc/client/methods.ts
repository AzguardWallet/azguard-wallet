import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { RPC_SERVICE_NAME } from ".";

export enum RpcServiceMethod {
    Invoke,
}

export class InvokeRequest extends RequestMessage {
    constructor(
        public readonly fn: string,
        public readonly args: unknown,
    ) {
        super(RPC_SERVICE_NAME, RpcServiceMethod.Invoke);
    }
}

export class InvokeResponse extends ResponseMessage {
    constructor(
        request: InvokeRequest,
        result?: [string, unknown],
        error?: string,
    ) {
        super(RPC_SERVICE_NAME, request.requestId, result, error);
    }
}