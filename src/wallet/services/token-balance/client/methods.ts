import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { TokenBalanceInfo, TOKEN_BALANCE_SERVICE_NAME } from ".";

export enum TokenBalanceServiceMethod {
    GetTokenBalances,
    RefreshTokenBalance,
}

export class GetTokenBalancesRequest extends RequestMessage {
    constructor(
        public readonly token?: number,
        public readonly account?: string,
    ) {
        super(TOKEN_BALANCE_SERVICE_NAME, TokenBalanceServiceMethod.GetTokenBalances);
    }
}

export class GetTokenBalancesResponse extends ResponseMessage {
    constructor(
        request: GetTokenBalancesRequest,
        result?: TokenBalanceInfo[],
        error?: string,
    ) {
        super(TOKEN_BALANCE_SERVICE_NAME, request.requestId, result, error);
    }
}

export class RefreshTokenBalanceRequest extends RequestMessage {
    constructor(
        public readonly tokenBalanceId: number,
    ) {
        super(TOKEN_BALANCE_SERVICE_NAME, TokenBalanceServiceMethod.RefreshTokenBalance);
    }
}

export class RefreshTokenBalanceResponse extends ResponseMessage {
    constructor(
        request: RefreshTokenBalanceRequest,
        error?: string,
    ) {
        super(TOKEN_BALANCE_SERVICE_NAME, request.requestId, undefined, error);
    }
}