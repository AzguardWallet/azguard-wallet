import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { LoggerServiceClient } from "@/wallet/services/logger/client"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Events, type Methods, TOKEN_BALANCE_SERVICE_NAME, type TokenBalanceInfo } from "./spec"

export * from "./spec"

export class TokenBalanceServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onTokenBalanceAdded = new EventHandler<TokenBalanceInfo>()
	public readonly onTokenBalanceUpdated = new EventHandler<TokenBalanceInfo>()
	public readonly onTokenBalanceDeleted = new EventHandler<TokenBalanceInfo>()

	public constructor(name?: string) {
		super(TOKEN_BALANCE_SERVICE_NAME, new LoggerServiceClient(), name)
	}

	public getTokenBalance(id: number): Promise<TokenBalanceInfo> {
		return this.request("getTokenBalance", id)
	}

	public getTokenBalances(tokenId?: number, accountAddress?: string): Promise<TokenBalanceInfo[]> {
		return this.request("getTokenBalances", tokenId, accountAddress)
	}

	public refreshTokenBalance(id: number): Promise<void> {
		return this.request("refreshTokenBalance", id)
	}
}
