import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { WALLET_CONNECT_SERVICE_NAME } from ".";

export enum WalletConnectServiceMethod {
    ConnectByURI,
}

export class ConnectByURIRequest extends RequestMessage {
    constructor(
        public readonly uri: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.ConnectByURI);
    }
}

export class ConnectByURIResponse extends ResponseMessage {
    constructor(
        request: ConnectByURIRequest,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.requestId, undefined, error);
    }
}
