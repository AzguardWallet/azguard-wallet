import { RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { TokenInfo, TokenInterface, TOKEN_SERVICE_NAME } from ".";

export enum TokenServiceMethod {
    GetInterface,
    ParseInterface,
    GetTokens,
    GetToken,
    AddToken,
    UpdateToken,
    DeleteToken,
}

export class GetTokensRequest extends RequestMessage {
    constructor(
        public readonly chainId: number,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.GetTokens);
    }
}

export class GetTokensResponse extends ResponseMessage {
    constructor(
        request: GetTokensRequest,
        result?: TokenInfo[],
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class GetTokenRequest extends RequestMessage {
    constructor(
        public readonly tokenId: number,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.GetToken);
    }
}

export class GetTokenResponse extends ResponseMessage {
    constructor(
        request: GetTokenRequest,
        result?: TokenInfo,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class AddTokenRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly networkId: string,
        public readonly address: string,
        public readonly tokenInterface: TokenInterface,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.AddToken);
    }
}

export class AddTokenResponse extends ResponseMessage {
    constructor(
        request: AddTokenRequest,
        result?: TokenInfo,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class UpdateTokenRequest extends RequestMessage {
    constructor(
        public readonly profileId: string,
        public readonly networkId: string,
        public readonly address: string,
        public readonly tokenId: number,
        public readonly tokenInterface: TokenInterface,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.UpdateToken);
    }
}

export class UpdateTokenResponse extends ResponseMessage {
    constructor(
        request: UpdateTokenRequest,
        result?: TokenInfo,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class DeleteTokenRequest extends RequestMessage {
    constructor(
        public readonly tokenId: number,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.DeleteToken);
    }
}

export class DeleteTokenResponse extends ResponseMessage {
    constructor(
        request: DeleteTokenRequest,
        result?: TokenInfo,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class GetInterfaceRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly tokenId: number,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.GetInterface);
    }
}

export class GetInterfaceResponse extends ResponseMessage {
    constructor(
        request: GetInterfaceRequest,
        result?: TokenInterface,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}

export class ParseInterfaceRequest extends RequestMessage {
    constructor(
        public readonly networkId: string,
        public readonly contract: string,
    ) {
        super(TOKEN_SERVICE_NAME, TokenServiceMethod.ParseInterface);
    }
}

export class ParseInterfaceResponse extends ResponseMessage {
    constructor(
        request: ParseInterfaceRequest,
        result?: TokenInterface,
        error?: string,
    ) {
        super(TOKEN_SERVICE_NAME, request.id, result, error);
    }
}