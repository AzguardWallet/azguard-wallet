import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, Methods, TOKEN_BALANCE_SERVICE_NAME, TokenBalanceInfo } from "./spec";

export * from "./spec";

export class TokenBalanceServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onTokenBalanceAdded = new EventHandler<TokenBalanceInfo>();
    public readonly onTokenBalanceUpdated = new EventHandler<TokenBalanceInfo>();
    public readonly onTokenBalanceDeleted = new EventHandler<TokenBalanceInfo>();

    public constructor(name?: string) {
        super(TOKEN_BALANCE_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getTokenBalances(tokenId?: number, accountAddress?: string): Promise<TokenBalanceInfo[]> {
        return this.request("getTokenBalances", tokenId, accountAddress);
    }

    public refreshTokenBalance(id: number): Promise<void> {
        return this.request("refreshTokenBalance", id);
    }
}
