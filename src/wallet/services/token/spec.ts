import { FnImpl } from "@/wallet/utils/fn"

export const TOKEN_SERVICE_NAME = "token"

export type Token = {
	id: number
	profileId: string

	chainId: number
	contract: string

	name: string
	symbol: string
	decimals: number

	getNameFn?: FnImpl
	getSymbolFn?: FnImpl
	getDecimalsFn?: FnImpl
	balanceOfPublicFn?: FnImpl
	balanceOfPrivateFn?: FnImpl
	transferPublicFn?: FnImpl
	transferPrivateFn?: FnImpl
	transferPublicToPrivateFn?: FnImpl
	transferPrivateToPublicFn?: FnImpl
}

export type TokenInfo = {
	/** Internal id. */
	id: number
	/** Chain id. */
	chainId: number
	/** Token contract address. */
	contract: string
	/** Token name. */
	name: string
	/** Token symbol. */
	symbol: string
	/** Token decimals. */
	decimals: number
	/** Whether or not the token has this functionality. */
	hasPublicBalances: boolean
	/** Whether or not the token has this functionality. */
	hasPublicTransfers: boolean
	/** Whether or not the token has this functionality. */
	hasPublicToPrivateTransfers: boolean
	/** Whether or not the token has this functionality. */
	hasPrivateBalances: boolean
	/** Whether or not the token has this functionality. */
	hasPrivateTransfers: boolean
	/** Whether or not the token has this functionality. */
	hasPrivateToPublicTransfers: boolean
}

export type TokenInterface = {
	/** Chain id. */
	chainId: number
	/** Contract address. */
	contract: string

	/** Function to get token name. */
	getNameFn?: FnImpl
	/** Functions with `getNameFn`-like signature. */
	getNameFnCandidates: FnImpl[]

	/** Function to get token symbol. */
	getSymbolFn?: FnImpl
	/** Functions with `getSymbolFn`-like signature. */
	getSymbolFnCandidates: FnImpl[]

	/** Function to get token decimals. */
	getDecimalsFn?: FnImpl
	/** Functions with `getDecimalsFn`-like signature. */
	getDecimalsFnCandidates: FnImpl[]

	/** Function to get public balance. */
	balanceOfPublicFn?: FnImpl
	/** Functions with `balanceOfPublicFn`-like signature. */
	balanceOfPublicFnCandidates: FnImpl[]

	/** Function to get private balance. */
	balanceOfPrivateFn?: FnImpl
	/** Functions with `balanceOfPrivateFn`-like signature. */
	balanceOfPrivateFnCandidates: FnImpl[]

	/** Function to make public transfer. */
	transferPublicFn?: FnImpl
	/** Functions with `transferPublicFn`-like signature. */
	transferPublicFnCandidates: FnImpl[]

	/** Function to make private transfer. */
	transferPrivateFn?: FnImpl
	/** Functions with `transferPrivateFn`-like signature. */
	transferPrivateFnCandidates: FnImpl[]

	/** Function to make public to private transfer. */
	transferPublicToPrivateFn?: FnImpl
	/** Functions with `transferPublicToPrivateFn`-like signature. */
	transferPublicToPrivateFnCandidates: FnImpl[]

	/** Function to make private to public transfer. */
	transferPrivateToPublicFn?: FnImpl
	/** Functions with `transferPrivateToPublicFn`-like signature. */
	transferPrivateToPublicFnCandidates: FnImpl[]

	/** Whether or not the token has complete functionality */
	isComplete: boolean
}

export type Methods = {
	/**
	 * Returns a list of tokens.
	 * @param profileId Profile id.
	 * @param chainId Chain id.
	 */
	getTokens(profileId?: string, chainId?: number): TokenInfo[]

	/**
	 * Returns a token with the specified id, or undefined if it doesn't exist.
	 * @param id Token id.
	 */
	getToken(id: number): TokenInfo

	/**
	 * Creates and returns a new token.
	 * @param profileId Profile id.
	 * @param networkId Network id.
	 * @param accountAddress Account address.
	 * @param tokenInterface Token interface, determining token's functionality.
	 */
	addToken(profileId: string, networkId: string, accountAddress: string, tokenInterface: TokenInterface): TokenInfo

	/**
	 * Updates token and returns it.
	 * @param profileId Profile id.
	 * @param networkId Network id.
	 * @param accountAddress Account address.
	 * @param tokenId Token id.
	 * @param tokenInterface Token interface, determining token's functionality.
	 */
	updateToken(profileId: string, networkId: string, accountAddress: string, tokenId: number, tokenInterface: TokenInterface): TokenInfo

	/**
	 * Deletes token with the specified id and returns it.
	 * @param id Token id.
	 */
	deleteToken(id: number): TokenInfo

	/**
	 * Returns interface of the token with the specified id.
	 * @param networkId Network id.
	 * @param tokenId Token id.
	 */
	getTokenInterface(networkId: string, tokenId: number): TokenInterface

	/**
	 * Parses contract and returns token interface.
	 * @param networkId Network id.
	 * @param contract Token contract address.
	 */
	parseTokenInterface(networkId: string, contract: string): TokenInterface
}

export type Events = {
	/** Emitted when a new token is created */
	onTokenAdded: TokenInfo
	/** Emitted when an existing token is updated */
	onTokenUpdated: TokenInfo
	/** Emitted when an existing token is deleted */
	onTokenDeleted: TokenInfo
}
