import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { WALLET_CONNECT_SERVICE_NAME } from ".";
import type { DappSession } from "@/wallet/services/interaction/client/models";
import type { Account } from "@/wallet/services/account/client/models";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum WalletConnectServiceMethod {
    ConnectByURI,
    ValidateProposal,
    ApproveDappSession,
    RejectDappSession,
    DropDappSession,
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

export class ValidateProposalRequest extends RequestMessage {
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload: any,
        public readonly address: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.ValidateProposal);
    }
}

export class ValidateProposalResponse extends ResponseMessage {
    constructor(
        request: ValidateProposalRequest,
        result?: boolean,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}

export class ApproveDappSessionRequest extends RequestMessage {
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload: any,
        public readonly accounts: Array<Account>,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.ApproveDappSession);
    }
}

export class ApproveDappSessionResponse extends ResponseMessage {
    constructor(
        request: ApproveDappSessionRequest,
        result?: DappSession,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}

export class RejectDappSessionRequest extends RequestMessage {
    constructor(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        public readonly payload: any,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.RejectDappSession);
    }
}

export class RejectDappSessionResponse extends ResponseMessage {
    constructor(
        request: RejectDappSessionRequest,
        result?: boolean,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}

export class DropDappSessionRequest extends RequestMessage {
    constructor(
        public readonly dappSession: DappSession,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, WalletConnectServiceMethod.DropDappSession);
    }
}

export class DropDappSessionResponse extends ResponseMessage {
    constructor(
        request: DropDappSessionRequest,
        result?: boolean,
        error?: string,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, request.id, result, error);
    }
}
