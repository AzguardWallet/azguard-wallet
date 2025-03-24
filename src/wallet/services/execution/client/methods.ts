import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import {
    EXECUTION_SERVICE_NAME,
    TransferType,
    IOperation,
    IOperationResult,
    FeeSettings,
} from ".";

export enum ExecutionServiceMethod {
    ExecuteTransfer,
    ExecuteOperations,
}

export class ExecuteTransferRequest extends RequestMessage {
    public readonly amount: string;

    constructor(
        public readonly network: string,
        public readonly account: string,
        public readonly token: number,
        public readonly transferType: TransferType,
        public readonly recipient: string,
        amount: number | bigint,
        public readonly feeSettings: FeeSettings,
    ) {
        super(EXECUTION_SERVICE_NAME, ExecutionServiceMethod.ExecuteTransfer);
        this.amount = amount.toString(10);
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

export class ExecuteOperationsRequest extends RequestMessage {
    constructor(
        public readonly operations: IOperation[],
        public readonly origin: string,
    ) {
        super(EXECUTION_SERVICE_NAME, ExecutionServiceMethod.ExecuteOperations);
    }
}

export class ExecuteOperationsResponse extends ResponseMessage {
    constructor(
        request: ExecuteOperationsRequest,
        result?: IOperationResult[],
        error?: string,
    ) {
        super(EXECUTION_SERVICE_NAME, request.id, result, error);
    }
}
