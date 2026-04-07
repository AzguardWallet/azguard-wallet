import { FunctionType } from "@aztec/stdlib/abi";
import { ILogger } from "@/wallet/logger";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { getTokenInfo } from "@/wallet/services/token/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max, sleep } from "@/wallet/utils";
import { Queue } from "@/wallet/utils/queue";
import { AccountService, Account } from "@/wallet/services/account/service";
import { NetworkService } from "@/wallet/services/network/service";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { TokenService, Token, TokenInfo } from "@/wallet/services/token/service";
import { BalanceOfPrivateFn, BalanceOfPublicFn } from "@/wallet/services/token/functions";
import { ExecutionService, CallAction, EncodedCallAction } from "@/wallet/services/execution/service";
import { TaskService, BalanceUpdateContent } from "@/wallet/services/task/service";
import { isLocalTx, OriginType, TransactionService, Tx, TxStatus } from "@/wallet/services/transaction/service";
import type { ViewFn } from "@/wallet/utils/fn";
import { getErrorMessage } from "@/wallet/utils/errors";
import { TOKEN_BALANCE_SERVICE_NAME, TokenBalanceRaw, TokenBalanceInfo, Methods, Events } from "./spec";

export * from "./spec";

export class TokenBalanceService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = TOKEN_BALANCE_SERVICE_NAME;

    public readonly onTokenBalanceAdded = new EventHandler<TokenBalanceInfo>();
    public readonly onTokenBalanceUpdated = new EventHandler<TokenBalanceInfo>();
    public readonly onTokenBalanceDeleted = new EventHandler<TokenBalanceInfo>();

    private readonly balances = new EntityStorage<TokenBalanceRaw>("azguard:core:token-balances", StorageType.Local);
    private readonly queue = new Queue<number, TokenBalanceRaw>(x => x.id);
    private readonly pendingTasks = new Map<number, string>();
    private readonly tokens = new Map<number, Token>();

    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private tokenService: TokenService = null!;
    private transactionService: TransactionService = null!;
    private executionService: ExecutionService = null!;
    private taskService: TaskService = null!;

    private profile?: ProfileInfo = undefined;
    private worker?: Promise<void>;

    public constructor(logger: ILogger) {
        super(TOKEN_BALANCE_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.tokenService = services.get(TokenService.name);
        this.transactionService = services.get(TransactionService.name);
        this.executionService = services.get(ExecutionService.name);
        this.taskService = services.get(TaskService.name);

        this.profileService.onActiveProfileChanged.add(this.onActiveProfileChanged);
        this.accountService.onAccountAdded.add(this.onAccountAdded);
        this.tokenService.onTokenAdded.add(this.onTokenAdded);
        this.tokenService.onTokenUpdated.add(this.onTokenUpdated);
        this.tokenService.onTokenDeleted.add(this.onTokenDeleted);
        this.transactionService.onTransactionUpdated.add(this.onTransactionUpdated);

        this.profile = await this.profileService.getActiveProfile();
        if (this.profile) {
            for (const token of await this.tokenService.getTokensRaw(this.profile.id)) {
                this.tokens.set(token.id, token);
            }
        }

        this.worker = this.startWorker();
    }

    public async getTokenBalance(id: number): Promise<TokenBalanceInfo> {
        await this.ensureInitialized();
        const balance = await this.balances.get(`${id}`);
        if (!balance) {
            throw new Error("unknown token balance id");
        }
        
        return this.getTokenBalanceInfo(balance);
    }

    public async getTokenBalances(tokenId?: number, accountAddress?: string): Promise<TokenBalanceInfo[]> {
        await this.ensureInitialized();
        return (await this.balances.getValues())
            .filter(x => tokenId === undefined || x.token === tokenId)
            .filter(x => accountAddress === undefined || x.account === accountAddress)
            .map(x => this.getTokenBalanceInfo(x), this);
    }

    public async refreshTokenBalance(id: number): Promise<void> {
        const balance = await this.balances.get(`${id}`);
        if (!balance) {
            throw new Error("unknown token balance id");
        }
        this.addBalanceToRefreshQueue(balance);
    }

    public async refreshAccountBalances(account: string): Promise<void> {
        for (const balance of (await this.balances.getValues()).filter(x => x.account === account)) {
            this.addBalanceToRefreshQueue(balance);
        }
    }

    private addBalanceToRefreshQueue(balance: TokenBalanceRaw): void {
        if (!this.pendingTasks.has(balance.id)) {
            const task = this.taskService.createNewTask(new BalanceUpdateContent(balance.id, balance.account));
            this.pendingTasks.set(balance.id, task.id);
        }
        this.queue.priorityPass(balance);
    }

    private async createTokenBalance(token: Token, account: Account) {
        const tb: TokenBalanceRaw = {
            id: array_max((await this.balances.getKeys()).map(x => +x)) + 1,
            token: token.id,
            account: account.address,
            privateBalance: "0",
            publicBalance: "0",
            updatedAt: 0,
        };
        await this.balances.set(`${tb.id}`, tb);
        this.emit("onTokenBalanceAdded", this.getTokenBalanceInfo(tb));
        this.addBalanceToRefreshQueue(tb);
    }

    private getTokenBalanceInfo(tb: TokenBalanceRaw, tokenInfo?: TokenInfo): TokenBalanceInfo {
        if (!tokenInfo) {
            const token = this.tokens.get(tb.token);
            if (!token) {
                throw new Error("unknown token");
            }
            tokenInfo = getTokenInfo(token);
        }
        return {
            id: tb.id,
            token: tokenInfo,
            account: tb.account,
            publicBalance: tb.publicBalance,
            privateBalance: tb.privateBalance,
            updatedAt: tb.updatedAt,
        };
    }

    private readonly onActiveProfileChanged = async (profile?: ProfileInfo) => {
        this.profile = profile;
        if (profile) {
            this.tokens.clear();
            for (const token of await this.tokenService.getTokensRaw(profile.id)) {
                this.tokens.set(token.id, token);
            }
        }
    };

    private readonly onAccountAdded = async (account: Account) => {
        for (const token of this.tokens.values().filter(x => x.chainId === account.chainId)) {
            await this.createTokenBalance(token, account);
        }
    };

    private readonly onTokenAdded = async (token: TokenInfo) => {
        const tokenRaw = await this.tokenService.getTokenRaw(token.id);
        this.tokens.set(token.id, tokenRaw);
        for (const account of await this.accountService.getAccounts(this.profile!.id, token.chainId, true)) {
            await this.createTokenBalance(tokenRaw, account);
        }
    };

    private readonly onTokenUpdated = async (token: TokenInfo) => {
        this.tokens.set(token.id, await this.tokenService.getTokenRaw(token.id));
        for (const tb of (await this.balances.getValues()).filter(x => x.token === token.id)) {
            this.addBalanceToRefreshQueue(tb);
        }
    };

    private readonly onTokenDeleted = async (token: TokenInfo) => {
        this.tokens.delete(token.id);
        for (const tb of (await this.balances.getValues()).filter(x => x.token === token.id)) {
            await this.balances.delete(`${tb.id}`);
            this.emit("onTokenBalanceDeleted", this.getTokenBalanceInfo(tb, token));
        }
    };

    private readonly onTransactionUpdated = async (tx: Tx) => {
        if (tx.status !== TxStatus.Pending) {
            if (tx.origin.type === OriginType.UI && isLocalTx(tx)) {
                const addresses = new Set<string>()
                const contracts = new Set<string>()
                const tokenIds = new Set<number>()

                for (const c of tx.calls) {
                    if (c.contract && c.transfers) {
                        contracts.add(c.contract);
                    }
                    if (c.transfers) {
                        for (const t of c.transfers) {
                            addresses.add(t.to);
                            addresses.add(t.from);
                        }
                    }
                }

                // If we found specific transfer info, refresh only affected balances.
                // Otherwise (e.g. faucet mints, generic contract calls), refresh all
                // balances for the tx account since we can't narrow the scope.
                if (addresses.size > 0 && contracts.size > 0) {
                    for (const t of this.tokens.values()) {
                        if (contracts.has(t.contract)) {
                            tokenIds.add(t.id);
                        }
                    }

                    const _balances = await this.balances.getValues();
                    for (const tb of _balances) {
                        if (addresses.has(tb.account) && tokenIds.has(tb.token)) {
                            this.addBalanceToRefreshQueue(tb);
                        }
                    }
                } else {
                    await this.refreshAccountBalances(tx.account);
                }

                return;
            }

            await this.refreshAccountBalances(tx.account);
        };
    };

    private async startWorker() {
        while (true) {
            if (this.profile) {
                try {
                    if (this.queue.length) {
                        this.logDebug(`Syncing ${this.queue.length} token balances`);
                        const start = Date.now();
                        while (this.queue.length) {
                            const firstAccount = this.queue.peek()!.account;
                            const tbs: TokenBalanceRaw[] = [];
                            while (this.queue.peek()?.account === firstAccount && tbs.length < 12) {
                                tbs.push(this.queue.dequeue()!);
                            }
                            await this.syncBatch(firstAccount, tbs);
                        }
                        const end = Date.now();
                        this.logDebug(`Token balances synced in ${end - start}ms`);
                    }
                } catch (error) {
                    this.logError("Failed to sync token balances.", getErrorMessage(error));
                }
            }
            await sleep(1000);
        }
    }

    private async syncBatch(account: string, tbs: TokenBalanceRaw[]) {
        for (const tb of tbs) {
            const taskId = this.pendingTasks.get(tb.id);
            if (!taskId) {
                const task = this.taskService.startNewTask(new BalanceUpdateContent(tb.id, account));
                this.pendingTasks.set(tb.id, task.id);
            } else {
                this.taskService.startTask(taskId);
            }
        }

        try {
            this.logDebug(`Syncing ${tbs.length} balances for ${account}`);
            const start = Date.now();

            const calls: [CallAction | EncodedCallAction, number, boolean, ViewFn][] = [];
            let chainId: number | undefined;
            for (let i = 0; i < tbs.length; i++) {
                const tb = tbs[i];
                const token = this.tokens.get(tb.token);
                if (!token) {
                    this.logError(`Unknown token #${tb.token}`);
                    const taskId = this.pendingTasks.get(tb.id)!;
                    this.taskService.failTask(taskId, `Unknown token #${tb.token}`);
                    continue;
                }
                chainId = token.chainId;
                // sync private balance
                if (token.balanceOfPrivateFn) {
                    const balanceOfPrivateFn = BalanceOfPrivateFn.new(
                        token.balanceOfPrivateFn.name,
                        token.balanceOfPrivateFn.impl,
                    );
                    if (balanceOfPrivateFn.type === FunctionType.UTILITY) {
                        calls.push([
                            {
                                kind: "call",
                                contract: token.contract,
                                method: balanceOfPrivateFn.name,
                                args: balanceOfPrivateFn.buildArgs(account),
                            },
                            i,
                            true,
                            balanceOfPrivateFn,
                        ]);
                    } else {
                        const selector = await balanceOfPrivateFn.getSelector();
                        const encodedArgs = balanceOfPrivateFn.encodeArgs(balanceOfPrivateFn.buildArgs(account));
                        calls.push([
                            {
                                kind: "encoded_call",
                                to: token.contract,
                                selector: selector.toString(),
                                args: encodedArgs.map(x => x.toString()),
                                name: balanceOfPrivateFn.name,
                                type: balanceOfPrivateFn.type,
                                isStatic: balanceOfPrivateFn.isStatic,
                                returnTypes: balanceOfPrivateFn.getReturnTypes(),
                            },
                            i,
                            true,
                            balanceOfPrivateFn,
                        ]);
                    }
                } else {
                    tb.privateBalance = "0";
                }
                // sync public balance
                if (token.balanceOfPublicFn) {
                    const balanceOfPublicFn = BalanceOfPublicFn.new(
                        token.balanceOfPublicFn.name,
                        token.balanceOfPublicFn.impl,
                    );
                    if (balanceOfPublicFn.type === FunctionType.UTILITY) {
                        calls.push([
                            {
                                kind: "call",
                                contract: token.contract,
                                method: balanceOfPublicFn.name,
                                args: balanceOfPublicFn.buildArgs(account),
                            },
                            i,
                            false,
                            balanceOfPublicFn,
                        ]);
                    } else {
                        const selector = await balanceOfPublicFn.getSelector();
                        const encodedArgs = balanceOfPublicFn.encodeArgs(balanceOfPublicFn.buildArgs(account));
                        calls.push([
                            {
                                kind: "encoded_call",
                                to: token.contract,
                                selector: selector.toString(),
                                args: encodedArgs.map(x => x.toString()),
                                name: balanceOfPublicFn.name,
                                type: balanceOfPublicFn.type,
                                isStatic: balanceOfPublicFn.isStatic,
                                returnTypes: balanceOfPublicFn.getReturnTypes(),
                            },
                            i,
                            false,
                            balanceOfPublicFn,
                        ]);
                    }
                } else {
                    tb.publicBalance = "0";
                }
            }
            if (chainId !== undefined) {
                const network = (await this.networkService.getNetworks(chainId)).find(x => x.isDefault);
                if (!network) {
                    throw new Error(`Failed to find network #${chainId}`);
                }
                const results = await this.executionService.executeSimulateViews({
                    kind: "simulate_views",
                    networkId: network.id,
                    accountAddress: account,
                    calls: calls.map(x => x[0]),
                });
                for (let i = 0; i < calls.length; i++) {
                    const [_, tbIndex, isPrivate, viewFn] = calls[i];
                    const balance = (viewFn.unpackResult(results.encoded[i]) as bigint).toString();
                    if (isPrivate) {
                        if (tbs[tbIndex].privateBalance !== balance) {
                            this.logDebug(
                                `Private balance #${tbs[tbIndex].id} changed: ${tbs[tbIndex].privateBalance} -> ${balance}`,
                            );
                            tbs[tbIndex].privateBalance = balance;
                        }
                    } else {
                        if (tbs[tbIndex].publicBalance !== balance) {
                            this.logDebug(
                                `Public balance #${tbs[tbIndex].id} changed: ${tbs[tbIndex].publicBalance} -> ${balance}`,
                            );
                            tbs[tbIndex].publicBalance = balance;
                        }
                    }
                }
            }
            const now = Date.now();
            const balances = await this.balances.getValues();
            for (const tb of tbs) {
                tb.updatedAt = now;
                const balance = balances.find(x => x.token === tb.token && x.account === tb.account);

                const taskId = this.pendingTasks.get(tb.id)!;
                if (balance) {
                    await this.balances.set(`${tb.id}`, tb);
                    this.taskService.completeTask(taskId);
                    this.emit("onTokenBalanceUpdated", this.getTokenBalanceInfo(tb));
                } else {
                    this.taskService.failTask(taskId, "Balance record not found");
                }
            }

            const stop = Date.now();
            this.logDebug(`Synced in ${stop - start}ms`);
        } catch (error) {
            const errorMessage = getErrorMessage(error);
            this.logError("Failed to sync", errorMessage);
            for (const tb of tbs) {
                const taskId = this.pendingTasks.get(tb.id)!;
                const task = this.taskService.getTaskSync(taskId);
                if (!task.finishedAt) {
                    this.taskService.failTask(taskId, errorMessage);
                }
            }
        } finally {
            tbs.forEach(tb => this.pendingTasks.delete(tb.id));
        }
    }

    public async backup(): Promise<TokenBalanceRaw[]> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        return (await this.balances.getValues());
    }

    public async restore(tokenBalances: TokenBalanceRaw[]): Promise<Restored<TokenBalanceRaw>[]> {
        await this.ensureInitialized();

        const result: Restored<TokenBalanceRaw>[] = [];
        for (const tb of tokenBalances) {
            try {
                const id = array_max((await this.balances.getKeys()).map(x => +x)) + 1;
                await this.balances.set(`${id}`, { ...tb, id });
                result.push({ ...tb, id });
            } catch (err) {
                result.push({
                    ...tb,
                    restoreError: err instanceof Error ? err.message : err,
                });
            }
        }

        return result;
    }
}
