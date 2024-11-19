import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Network, WALLET_CONNECT_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum WalletConnectServiceMethod {
    ConnectByURL,
    SessionRequest,
    SessionAuth,
}

export class ConnectByURLRequest extends RequestMessage {
    constructor(
        public readonly uri: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.ConnectByURL);
    }
}

export class ConnectByURLResponse extends ResponseMessage {
    constructor(
        request: ConnectByURLRequest,
        result?: boolean,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}
