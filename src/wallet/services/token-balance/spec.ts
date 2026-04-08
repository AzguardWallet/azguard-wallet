import type { TokenInfo } from "@/wallet/services/token/spec"

export const TOKEN_BALANCE_SERVICE_NAME = "token-balance"

export type TokenBalanceRaw = {
	id: number
	token: number
	account: string
	publicBalance?: string
	privateBalance?: string
	updatedAt: number
}

export type TokenBalanceInfo = {
	id: number
	token: TokenInfo
	account: string
	publicBalance?: string
	privateBalance?: string
	updatedAt: number
}

export type Methods = {
	/**
	 * Returns a token balance with the specified id.
	 * @param id Token balance id.
	 */
	getTokenBalance(id: number): TokenBalanceInfo

	/**
	 * Returns a list of token balances.
	 * @param tokenId Token id.
	 * @param accountAddress Account address.
	 */
	getTokenBalances(tokenId?: number, accountAddress?: string): TokenBalanceInfo[]

	/**
	 * Enqueues the token balance for immediate syncing.
	 * @param id Token balance id.
	 */
	refreshTokenBalance(id: number): void
}

export type Events = {
	onTokenBalanceAdded: TokenBalanceInfo
	onTokenBalanceUpdated: TokenBalanceInfo
	onTokenBalanceDeleted: TokenBalanceInfo
}
