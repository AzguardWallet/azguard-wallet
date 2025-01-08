import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { WALLET_CONNECT_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
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
        result?: boolean,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}
