import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Tx, TRANSACTION_SERVICE_NAME } from ".";

export enum TransactionServiceMethod {
    GetTransactions,
    GetTransaction,
}

export class GetTransactionsRequest extends RequestMessage {
    constructor(
        public readonly account: string,
    ) {
        super(TRANSACTION_SERVICE_NAME, TransactionServiceMethod.GetTransactions);
    }
}

export class GetTransactionsResponse extends ResponseMessage {
    constructor(
        request: GetTransactionsRequest,
        result?: Tx[],
        error?: string,
    ) {
        super(TRANSACTION_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetTransactionRequest extends RequestMessage {
    constructor(
        public readonly hash: string,
    ) {
        super(TRANSACTION_SERVICE_NAME, TransactionServiceMethod.GetTransaction);
    }
}

export class GetTransactionResponse extends ResponseMessage {
    constructor(
        request: GetTransactionRequest,
        result?: Tx,
        error?: string,
    ) {
        super(TRANSACTION_SERVICE_NAME, request.requestId, result, error);
    }
}
