import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { EXECUTION_SERVICE_NAME, IAction, TransferType } from ".";

export enum ExecutionServiceMethod {
    ExecuteBatch,
    ExecuteTransfer,
}

export class ExecuteBatchRequest extends RequestMessage {
    constructor(
        public readonly network: string,
        public readonly account: string,
        public readonly dappName: string,
        public readonly actions: IAction[],
    ) {
        super(EXECUTION_SERVICE_NAME, ExecutionServiceMethod.ExecuteBatch);
    }
}

export class ExecuteBatchResponse extends ResponseMessage {
    constructor(
        request: ExecuteBatchRequest,
        result?: string,
        error?: string,
    ) {
        super(EXECUTION_SERVICE_NAME, request.id, result, error);
    }
}

export class ExecuteTransferRequest extends RequestMessage {
    public readonly amount: string;

    constructor(
        public readonly network: string,
        public readonly account: string,
        public readonly token: number,
        public readonly transferType: TransferType,
        public readonly recipient: string,
        amount: number | bigint | string,
    ) {
        super(EXECUTION_SERVICE_NAME, ExecutionServiceMethod.ExecuteTransfer);
        this.amount = amount.toString();
    }
}

export class ExecuteTransferResponse extends ResponseMessage {
    constructor(
        request: ExecuteTransferRequest,
        result?: string,
        error?: string,
    ) {
        super(EXECUTION_SERVICE_NAME, request.id, result, error);
    }
}
