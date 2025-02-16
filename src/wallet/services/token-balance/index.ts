import { createPXEClient, PXE } from "@aztec/aztec.js"
import {
	EventMessage,
	RequestMessage,
	ResponseMessage,
} from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { array_max, sleep } from "@/wallet/utils"
import { Queue } from "@/wallet/utils/queue"
import { AccountService } from "@/wallet/services/account"
import { Account } from "@/wallet/services/account/client"
import { IAccountContract } from "@/wallet/services/account/contracts"
import { NetworkService } from "@/wallet/services/network"
import { Network } from "@/wallet/services/network/client"
import { ProfileService } from "@/wallet/services/profile"
import { Token, TokenService } from "@/wallet/services/token"
import { TokenInfo } from "@/wallet/services/token/client"
import {
	GetTokenBalancesRequest,
	GetTokenBalancesResponse,
	RefreshTokenBalanceRequest,
	RefreshTokenBalanceResponse,
	TOKEN_BALANCE_SERVICE_NAME,
	TokenBalanceInfo,
	TokenBalanceServiceEvent,
	TokenBalanceServiceEventMessage,
	TokenBalanceServiceMethod,
} from "./client"

type TokenBalanceRaw = {
	id: number
	token: number
	account: string
	publicBalance: string | undefined
	privateBalance: string | undefined
	updatedAt: number
}

export class TokenBalanceService extends Service {
	private readonly balances: EntityStorage<TokenBalanceRaw>
	private readonly queue: Queue<number, TokenBalanceRaw> = new Queue(
		(x) => x.id
	)
	private readonly worker: Promise<void>

	private profile?: string = undefined
	private readonly pxes: Map<number, PXE> = new Map()
	private readonly tokens: Map<number, Token> = new Map()

	constructor(
		private readonly profileService: ProfileService,
		private readonly networkService: NetworkService,
		private readonly accountService: AccountService,
		private readonly tokenService: TokenService,
		emit: (event: EventMessage) => void
	) {
		super(TOKEN_BALANCE_SERVICE_NAME, emit)
		this.balances = new EntityStorage(
			"azguard:core:token-balances",
			StorageType.Local
		)

		this.profileService.onActiveProfileChanged.push(this.onActiveProfileChanged)
		this.networkService.onDefaultNetworkChanged.push(this.onDefaultNetworkChanged)
		this.accountService.onAccountAdded.push(this.onAccountAdded)
		this.tokenService.onTokenAdded.push(this.onTokenAdded)
		this.tokenService.onTokenUpdated.push(this.onTokenUpdated)
		this.tokenService.onTokenDeleted.push(this.onTokenDeleted)

		this.worker = this.startWorker()
	}

	public async process(
		request: RequestMessage
	): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case TokenBalanceServiceMethod.GetTokenBalances: {
				const _request = request as GetTokenBalancesRequest
				try {
					const balances = await this.getBalances(
						_request.token,
						_request.account
					)
					return new GetTokenBalancesResponse(_request, balances)
				} catch (error: any) {
					return new GetTokenBalancesResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case TokenBalanceServiceMethod.RefreshTokenBalance: {
				const _request = request as RefreshTokenBalanceRequest
				try {
					await this.refreshBalance(_request.tokenBalanceId)
					return new RefreshTokenBalanceResponse(_request)
				} catch (error: any) {
					return new RefreshTokenBalanceResponse(
						_request,
						error.message
					)
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
	}

	public async getBalances(
		tokenId?: number,
		accountAddress?: string
	): Promise<TokenBalanceInfo[]> {
		return (await this.balances.getValues())
			.filter((x) => tokenId === undefined || x.token === tokenId)
			.filter(
				(x) =>
					accountAddress === undefined || x.account === accountAddress
			)
			.map((x) => this.getTokenBalanceInfo(x), this)
	}

	public async refreshAccountBalances(account: string): Promise<void> {
		for (const balance of (await this.balances.getValues()).filter(
			(x) => x.account === account
		)) {
			this.queue.priorityPass(balance)
		}
	}

	public async refreshBalance(id: number): Promise<void> {
		const balance = await this.balances.get(`${id}`)
		if (!balance) {
			throw new Error("unknown token balance id")
		}
		this.queue.priorityPass(balance)
	}

	private getTokenInfo(token: Token): TokenInfo {
		return new TokenInfo(
			token.id,
			token.chainId,
			token.contract,
			token.name,
			token.symbol,
			token.decimals,
			!!token.balanceOfPublicFn,
			!!token.transferPublicFn,
			!!token.transferPublicToPrivateFn,
			!!token.balanceOfPrivateFn,
			!!token.transferPrivateFn,
			!!token.transferPrivateToPublicFn
		)
	}

	private getTokenBalanceInfo(
		tb: TokenBalanceRaw,
		token?: Token
	): TokenBalanceInfo {
		const _token = token ?? this.tokens.get(tb.token)
		if (!_token) {
			throw new Error("unknown token")
		}
		return new TokenBalanceInfo(
			tb.id,
			this.getTokenInfo(_token),
			tb.account,
			tb.publicBalance,
			tb.privateBalance,
			tb.updatedAt,
		)
	}

	private async createTokenBalance(token: Token, account: Account) {
		const tb: TokenBalanceRaw = {
			id: array_max((await this.balances.getKeys()).map((x) => +x)) + 1,
			token: token.id,
			account: account.address,
			privateBalance: "0",
			publicBalance: "0",
			updatedAt: 0,
		}
		await this.balances.set(`${tb.id}`, tb)
		this.emit(
			new TokenBalanceServiceEventMessage(
				TokenBalanceServiceEvent.TokenBalanceAdded,
				this.getTokenBalanceInfo(tb)
			)
		)
		this.queue.priorityPass(tb)
	}

	private readonly onActiveProfileChanged = async (profileId?: string) => {
		this.profile = profileId
		if (profileId) {
			this.pxes.clear();
			for (const network of (await this.networkService.getNetworks()).filter((x) => x.isDefault)) {
				this.pxes.set(network.chainId, createPXEClient(network.rpcUrl))
			}
			this.tokens.clear();
			for (const token of await this.tokenService.getTokens(profileId)) {
				this.tokens.set(token.id, token)
			}
		}
	}

	private readonly onDefaultNetworkChanged = async (network: Network) => {
		this.pxes.set(network.chainId, createPXEClient(network.rpcUrl))
	}

	private readonly onAccountAdded = async (account: Account) => {
		for (const token of this.tokens.values().filter(x => x.chainId === account.chainId)) {
			await this.createTokenBalance(token, account)
		}
	}

	private readonly onTokenAdded = async (token: Token) => {
		this.tokens.set(token.id, token)
		for (const account of await this.accountService.getAccounts(
			this.profile!,
			token.chainId,
			true
		)) {
			await this.createTokenBalance(token, account)
		}
	}

	private readonly onTokenUpdated = async (token: Token) => {
		this.tokens.set(token.id, token)
		for (const tb of (await this.balances.getValues()).filter(
			(x) => x.token === token.id
		)) {
			this.queue.priorityPass(tb)
		}
	}

	private readonly onTokenDeleted = async (token: Token) => {
		this.tokens.delete(token.id)
		for (const tb of (await this.balances.getValues()).filter(
			(x) => x.token === token.id
		)) {
			await this.balances.delete(`${tb.id}`)
			this.emit(
				new TokenBalanceServiceEventMessage(
					TokenBalanceServiceEvent.TokenBalanceDeleted,
					this.getTokenBalanceInfo(tb, token)
				)
			)
		}
	}

	private async init() {
		while (true) {
			try {
				this.profile = (
					await this.profileService.getActiveProfile()
				)?.id

				if (this.profile) {
					for (const network of (await this.networkService.getNetworks()).filter((x) => x.isDefault)) {
						this.pxes.set(network.chainId, createPXEClient(network.rpcUrl))
					}
					for (const token of await this.tokenService.getTokens(this.profile)) {
						this.tokens.set(token.id, token)
					}
				}

				console.debug("Token balance service initialized")
				break
			} catch (error) {
				console.error(
					"Failed to initialize token balance service. Retry..."
				)
				await sleep(1000)
			}
		}
	}

	private async startWorker() {
		await this.init()
		let nextSync = 0
		while (true) {
			if (this.profile) {
				try {
					if (Date.now() >= nextSync) {
						for (const tb of await this.balances.getValues()) {
							this.queue.enqueue(tb)
						}
						nextSync = Date.now() + 60_000 // TODO: settings
					}
					if (this.queue.length) {
						console.debug(
							`Syncing ${this.queue.length} token balances`
						)
						const start = Date.now()
						const cache = new Map<string, IAccountContract>()
						while (this.queue.length) {
							await Promise.allSettled(
								this.queue
									.dequeueBatch(4)
									.map((x) => this.syncTokenBalance(x, cache)) // TODO: settings
							)
						}
						const end = Date.now()
						console.debug(
							`Token balances synced in ${end - start}ms`
						)
					}
				} catch (error) {
					console.error("Failed to sync token balances.", error)
				}
			}
			await sleep(1000)
		}
	}

	private async syncTokenBalance(
		tb: TokenBalanceRaw,
		cache: Map<string, IAccountContract>
	) {
		try {
			console.debug(`Syncing balance #${tb.id}...`)
			const start = Date.now()

			const token = this.tokens.get(tb.token)
			if (!token) {
				console.error("Unknown token")
				return
			}

			let pxe = this.pxes.get(token.chainId)
			if (!pxe) {
				console.error("Unknown network")
				return
			}

			let account = cache.get(tb.account)
			if (!account) {
				account = await this.accountService.getAccountContract(
					this.profile!,
					token.chainId,
					tb.account
				)
				cache.set(tb.account, account)
			}

			const [_privateBalance, _publicBalance] = await Promise.all([
				this.tokenService.getPrivateBalance(pxe, account, token),
				this.tokenService.getPublicBalance(pxe, account, token),
			])
			const privateBalance = _privateBalance.toString()
			const publicBalance = _publicBalance.toString()

			if (
				privateBalance !== tb.privateBalance ||
				publicBalance != tb.publicBalance
			) {
				console.debug(
					`Balance #${tb.id} changed: `,
					privateBalance,
					publicBalance
				)
				tb.privateBalance = privateBalance
				tb.publicBalance = publicBalance
			} else {
				console.debug(`Balance #${tb.id} unchanged`)
			}
			
			tb.updatedAt = Date.now()
			await this.balances.set(`${tb.id}`, tb)
			this.emit(
				new TokenBalanceServiceEventMessage(
					TokenBalanceServiceEvent.TokenBalanceUpdated,
					this.getTokenBalanceInfo(tb)
				)
			)

			const stop = Date.now()
			console.debug(`Balance #${tb.id} synced in ${stop - start}ms`)
		} catch (error) {
			console.error(`Failed to sync balance #${tb.id}`, error)
		}
	}
}
