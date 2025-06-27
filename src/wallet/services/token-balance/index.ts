import { FunctionType } from "@aztec/stdlib/abi"
import type {
	EventMessage,
	RequestMessage,
	ResponseMessage,
} from "@/wallet/base/port-service/messages"
import { Service } from "@/wallet/base/port-service/service"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { array_max, sleep } from "@/wallet/utils"
import { Queue } from "@/wallet/utils/queue"
import type { AccountService } from "@/wallet/services/account"
import type { Account } from "@/wallet/services/account/client"
import type { NetworkService } from "@/wallet/services/network"
import type { ProfileService } from "@/wallet/services/profile"
import type { Token, TokenService } from "@/wallet/services/token"
import { BalanceOfPrivateFn, BalanceOfPublicFn } from "@/wallet/services/token/functions"
import { TokenInfo } from "@/wallet/services/token/client"
import type { ExecutionService } from "@/wallet/services/execution"
import { CallAction, EncodedCallAction, SimulateViewsOperation } from "@/wallet/services/execution/client"
import type { TransactionService } from "@/wallet/services/transaction"
import { type Tx, TxStatus } from "@/wallet/services/transaction/client"
import type { ViewFn } from "@/wallet/utils/fn"
import type { TaskTrackerService } from "@/wallet/services/task-tracker"
import { StepContent, TaskStatus } from "@/wallet/services/task-tracker/client"
import {
	type GetTokenBalancesRequest,
	GetTokenBalancesResponse,
	type RefreshTokenBalanceRequest,
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

	private readonly pendingTasks: Map<number, string> = new Map()

	private profile?: string = undefined
	private readonly tokens: Map<number, Token> = new Map()

	constructor(
		private readonly profileService: ProfileService,
		private readonly networkService: NetworkService,
		private readonly accountService: AccountService,
		private readonly tokenService: TokenService,
		private readonly transactionService: TransactionService,
		private readonly executionService: ExecutionService,
		private readonly taskTrackerService: TaskTrackerService,
		emit: (event: EventMessage) => void
	) {
		super(TOKEN_BALANCE_SERVICE_NAME, emit)
		this.balances = new EntityStorage(
			"azguard:core:token-balances",
			StorageType.Local
		)

		this.profileService.onActiveProfileChanged.push(this.onActiveProfileChanged)
		this.accountService.onAccountAdded.push(this.onAccountAdded)
		this.tokenService.onTokenAdded.push(this.onTokenAdded)
		this.tokenService.onTokenUpdated.push(this.onTokenUpdated)
		this.tokenService.onTokenDeleted.push(this.onTokenDeleted)
		this.transactionService.onTransactionUpdated.push(this.onTransactionUpdated);

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
			this.addBalanceToRefreshQueue(balance)
		}
	}

	private addBalanceToRefreshQueue(balance: TokenBalanceRaw): void {
		if (!this.pendingTasks.has(balance.id)) {
			const task = this.taskTrackerService.createNewTask(new StepContent("Refresh token balance"))
			this.pendingTasks.set(balance.id, task.id)
		}
		this.queue.priorityPass(balance)
	}

	public async refreshBalance(id: number): Promise<void> {
		const balance = await this.balances.get(`${id}`)
		if (!balance) {
			throw new Error("unknown token balance id")
		}
		this.addBalanceToRefreshQueue(balance)
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
		this.addBalanceToRefreshQueue(tb)
	}

	private readonly onActiveProfileChanged = async (profileId?: string) => {
		this.profile = profileId
		if (profileId) {
			this.tokens.clear();
			for (const token of await this.tokenService.getTokens(profileId)) {
				this.tokens.set(token.id, token)
			}
		}
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
			this.addBalanceToRefreshQueue(tb)
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

	private readonly onTransactionUpdated = async (tx: Tx) => {
		if (tx.status !== TxStatus.Pending) {
			await this.refreshAccountBalances(tx.account);
		}
	}

	private async init() {
		while (true) {
			try {
				this.profile = (
					await this.profileService.getActiveProfile()
				)?.id

				if (this.profile) {
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
					// if (Date.now() >= nextSync) {
					// 	const balancesToUpdate = (await this.balances.getValues())
					// 		.toSorted((a, b) => a.account.localeCompare(b.account));

					// 	for (const tb of balancesToUpdate) {
					// 		this.queue.enqueue(tb)
					// 	}

					// 	nextSync = Date.now() + 60_000 // TODO: settings
					// }
					if (this.queue.length) {
						console.debug(
							`Syncing ${this.queue.length} token balances`
						)
						const start = Date.now()
						while (this.queue.length) {
							const firstAccount = this.queue.peek()!.account;
							const tbs: TokenBalanceRaw[] = [];
							while (this.queue.peek()?.account === firstAccount && tbs.length < 12) {
								tbs.push(this.queue.dequeue()!);
							}
							await this.syncBatch(firstAccount, tbs);
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

	private async syncBatch(account: string, tbs: TokenBalanceRaw[]) {
		for (const tb of tbs) {
			let taskId = this.pendingTasks.get(tb.id)
			if (!taskId) {
				const task = this.taskTrackerService.startNewTask(new StepContent("Refresh token balance"))
				this.pendingTasks.set(tb.id, task.id)
			} else {
				this.taskTrackerService.startTask(taskId)
			}
		}

		try {
			console.debug(`Syncing ${tbs.length} balances for ${account}`)
			const start = Date.now()

			const calls: [CallAction | EncodedCallAction, number, boolean, ViewFn][] = [];
			let chainId: number | undefined;
			for (let i = 0; i < tbs.length; i++) {
				const tb = tbs[i];
				const token = this.tokens.get(tb.token)
				if (!token) {
					console.error(`Unknown token #${tb.token}`)
					const taskId = this.pendingTasks.get(tb.id)
					if (taskId) {
						this.taskTrackerService.failTask(taskId, `Unknown token #${tb.token}`)
					}
					continue;
				}
				chainId = token.chainId;
				// sync private balance
				if (token.balanceOfPrivateFn) {
					const balanceOfPrivateFn = BalanceOfPrivateFn.new(
						token.balanceOfPrivateFn.name,
						token.balanceOfPrivateFn.impl
					)
					if (balanceOfPrivateFn.type === FunctionType.UTILITY) {
						calls.push([
							new CallAction(
								token.contract,
								balanceOfPrivateFn.name,
								balanceOfPrivateFn.buildArgs(account),
							),
							i,
							true,
							balanceOfPrivateFn,
						]);
					}
					else {
						const selector = await balanceOfPrivateFn.getSelector();
						const encodedArgs = balanceOfPrivateFn.encodeArgs(balanceOfPrivateFn.buildArgs(account))
						calls.push([
							new EncodedCallAction(
								token.contract,
								selector.toString(),
								encodedArgs.map(x => x.toString()),
								balanceOfPrivateFn.name,
								balanceOfPrivateFn.type,
								balanceOfPrivateFn.isStatic,
								balanceOfPrivateFn.getReturnTypes(),
							),
							i,
							true,
							balanceOfPrivateFn,
						]);
					}
				}
				else {
					tb.privateBalance = "0";
				}
				// sync public balance
				if (token.balanceOfPublicFn) {
					const balanceOfPublicFn = BalanceOfPublicFn.new(
						token.balanceOfPublicFn.name,
						token.balanceOfPublicFn.impl
					)
					if (balanceOfPublicFn.type === FunctionType.UTILITY) {
						calls.push([
							new CallAction(
								token.contract,
								balanceOfPublicFn.name,
								balanceOfPublicFn.buildArgs(account),
							),
							i,
							false,
							balanceOfPublicFn,
						]);
					}
					else {
						const selector = await balanceOfPublicFn.getSelector();
						const encodedArgs = balanceOfPublicFn.encodeArgs(balanceOfPublicFn.buildArgs(account))
						calls.push([
							new EncodedCallAction(
								token.contract,
								selector.toString(),
								encodedArgs.map(x => x.toString()),
								balanceOfPublicFn.name,
								balanceOfPublicFn.type,
								balanceOfPublicFn.isStatic,
								balanceOfPublicFn.getReturnTypes(),
							),
							i,
							false,
							balanceOfPublicFn,
						]);
					}
				}
				else {
					tb.publicBalance = "0";
				}
			}
			if (chainId) {
				const network = (await this.networkService.getNetworks(chainId)).find(x => x.isDefault);
				if (!network) {
					throw new Error(`Failed to find network #${chainId}`);
				}
				const results = await this.executionService.executeSimulateViews(
					new SimulateViewsOperation(
						network.id,
						account,
						calls.map(x => x[0]),
					),
				);
				for (let i = 0; i < calls.length; i++) {
					const [_, tbIndex, isPrivate, viewFn] = calls[i];
					const balance = (viewFn.unpackResult(results.encoded[i]) as bigint).toString();
					if (isPrivate) {
						if (tbs[tbIndex].privateBalance !== balance) {
							console.debug(`Private balance #${tbs[tbIndex].id} changed: ${tbs[tbIndex].privateBalance} -> ${balance}`);
							tbs[tbIndex].privateBalance = balance;
						}
					}
					else {
						if (tbs[tbIndex].publicBalance !== balance) {
							console.debug(`Public balance #${tbs[tbIndex].id} changed: ${tbs[tbIndex].publicBalance} -> ${balance}`);
							tbs[tbIndex].publicBalance = balance;
						}
					}
				}
			}
			const now = Date.now();
			const balances = await this.balances.getValues()
			for (const tb of tbs) {
				tb.updatedAt = now;
				const balance = balances.find(x => x.token === tb.token && x.account === tb.account);

				const taskId = this.pendingTasks.get(tb.id);
				if (balance) {
					await this.balances.set(`${tb.id}`, tb);
					if (taskId) {
						this.taskTrackerService.completeTask(taskId)
					}
					this.emit(
						new TokenBalanceServiceEventMessage(
							TokenBalanceServiceEvent.TokenBalanceUpdated,
							this.getTokenBalanceInfo(tb)
						)
					)
				} else {
					if (taskId) {
						this.taskTrackerService.failTask(taskId, "Balance record not found");
					}
				}
			}

			const stop = Date.now()
			console.debug(`Synced in ${stop - start}ms`)
		} catch (error) {
			console.error("Failed to sync", error)

			const errorMessage = (error as Error)?.message ?? error as string ?? "Sync failed";
			for (const tb of tbs) {
				const taskId = this.pendingTasks.get(tb.id)
				if (taskId) {
					try {
						const task = this.taskTrackerService.getTask(taskId);
						if (!task.finishedAt) {
							this.taskTrackerService.failTask(taskId, errorMessage);
						}
					} catch {
						// Task might not exist, ignore
					}
				}
			}
		} finally {
			tbs.forEach(tb => this.pendingTasks.delete(tb.id))
		}
	}
}
