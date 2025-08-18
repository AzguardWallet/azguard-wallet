import type { EventMessage } from "@/wallet/base/port-service/messages"
import { ServiceClient } from "@/wallet/base/port-service/service-client"
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import {
	TokenBalanceServiceEvent,
	type TokenBalanceServiceEventMessage,
} from "./events"
import type { TokenBalanceInfo } from "./models"
import { GetTokenBalancesRequest, RefreshTokenBalanceRequest } from "./methods"

export * from "./events"
export * from "./methods"
export * from "./models"

export const TOKEN_BALANCE_SERVICE_NAME = "token-balance"

/**
 * Client for interaction with the TokenBalanceService via messaging API
 */
export class TokenBalanceServiceClient extends ServiceClient {
	/**
	 * Creates TokenBalanceServiceClient instance.
	 * @param onConnected Callback, called when the client is connected to the background service.
	 * @param onDisconnected Callback, called when the client is disconnected from the background service.
	 * @param onTokenBalanceAdded Callback, called when a new token balance was created.
	 * @param onTokenBalanceUpdated Callback, called when an existing token balance was updated.
	 * @param onTokenBalanceDeleted Callback, called when an existing token balance was deleted.
	 */
	constructor(
		onConnected?: () => void,
		onDisconnected?: () => void,
		private readonly onTokenBalanceAdded?: (
			token: TokenBalanceInfo
		) => void,
		private readonly onTokenBalanceUpdated?: (
			token: TokenBalanceInfo
		) => void,
		private readonly onTokenBalanceDeleted?: (
			token: TokenBalanceInfo
		) => void
	) {
		super(TOKEN_BALANCE_SERVICE_NAME, new LoggerServiceClient(), onConnected, onDisconnected)
	}

	protected onEvent(message: EventMessage): void {
		switch (message.event) {
			case TokenBalanceServiceEvent.TokenBalanceAdded:
				if (this.onTokenBalanceAdded) {
					try {
						this.onTokenBalanceAdded(
							(message as TokenBalanceServiceEventMessage)
								.tokenBalance
						)
					} catch {}
				}
				break
			case TokenBalanceServiceEvent.TokenBalanceUpdated:
				if (this.onTokenBalanceUpdated) {
					try {
						this.onTokenBalanceUpdated(
							(message as TokenBalanceServiceEventMessage)
								.tokenBalance
						)
					} catch {}
				}
				break
			case TokenBalanceServiceEvent.TokenBalanceDeleted:
				if (this.onTokenBalanceDeleted) {
					try {
						this.onTokenBalanceDeleted(
							(message as TokenBalanceServiceEventMessage)
								.tokenBalance
						)
					} catch {}
				}
				break
			default:
				this.logError(`Unexpected event type ${message.event}.`)
				break
		}
	}

	/**
	 * Returns a list of token balances.
	 * @param token Token id.
	 * @param account Account address.
	 */
	public getTokenBalances(
		token?: number,
		account?: string
	): Promise<TokenBalanceInfo[]> {
		return this.request(new GetTokenBalancesRequest(token, account))
	}

	/**
	 * Enqueues the token balance for immediate syncing.
	 * @param id Token balance id.
	 */
	public async refreshTokenBalance(id: number): Promise<void> {
		await this.request(new RefreshTokenBalanceRequest(id))
	}
}
