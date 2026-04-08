import type { Token, TokenInfo, TokenInterface } from "./spec"

export const getTokenInfo = (token: Token): TokenInfo => ({
	id: token.id,
	chainId: token.chainId,
	contract: token.contract,
	name: token.name,
	symbol: token.symbol,
	decimals: token.decimals,
	hasPublicBalances: !!token.balanceOfPublicFn,
	hasPublicTransfers: !!token.transferPublicFn,
	hasPublicToPrivateTransfers: !!token.transferPublicToPrivateFn,
	hasPrivateBalances: !!token.balanceOfPrivateFn,
	hasPrivateTransfers: !!token.transferPrivateFn,
	hasPrivateToPublicTransfers: !!token.transferPrivateToPublicFn,
})

export const isTokenComplete = (ti: TokenInterface) =>
	!!ti.getNameFn &&
	!!ti.getSymbolFn &&
	!!ti.getDecimalsFn &&
	!!ti.balanceOfPrivateFn &&
	!!ti.balanceOfPublicFn &&
	!!ti.transferPublicFn &&
	!!ti.transferPrivateFn &&
	!!ti.transferPublicToPrivateFn &&
	!!ti.transferPrivateToPublicFn
