import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Account, ACCOUNT_SERVICE_NAME, AccountType } from ".";

export enum AccountServiceMethod {
    GetAccounts,
    GetAccount,
    CreateAccount,
    ChangeAccountName,
    ChangeAccountVisibility,
}

export class GetAccountsRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly all?: boolean,
    ) {
        super(ACCOUNT_SERVICE_NAME, AccountServiceMethod.GetAccounts);
    }
}

export class GetAccountsResponse extends ResponseMessage {
    constructor(
        request: GetAccountsRequest,
        result?: Account[],
        error?: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetAccountRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly address: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, AccountServiceMethod.GetAccount);
    }
}

export class GetAccountResponse extends ResponseMessage {
    constructor(
        request: GetAccountRequest,
        result?: Account,
        error?: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, request.requestId, result, error);
    }
}

export class CreateAccountRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly accountType: AccountType,
        public readonly name: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, AccountServiceMethod.CreateAccount);
    }
}

export class CreateAccountResponse extends ResponseMessage {
    constructor(
        request: CreateAccountRequest,
        result?: Account,
        error?: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, request.requestId, result, error);
    }
}

export class ChangeAccountNameRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly address: string,
        public readonly name: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, AccountServiceMethod.ChangeAccountName);
    }
}

export class ChangeAccountNameResponse extends ResponseMessage {
    constructor(
        request: ChangeAccountNameRequest,
        result?: Account,
        error?: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, request.requestId, result, error);
    }
}

export class ChangeAccountVisibilityRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly chainId: number,
        public readonly address: string,
        public readonly visible: boolean,
    ) {
        super(ACCOUNT_SERVICE_NAME, AccountServiceMethod.ChangeAccountVisibility);
    }
}

export class ChangeAccountVisibilityResponse extends ResponseMessage {
    constructor(
        request: ChangeAccountVisibilityRequest,
        result?: Account,
        error?: string,
    ) {
        super(ACCOUNT_SERVICE_NAME, request.requestId, result, error);
    }
}