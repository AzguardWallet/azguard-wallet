import { ContractArtifact } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Restored, ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { NetworkService } from "@/wallet/services/network/service";
import { ProfileService, ProfileInfo } from "@/wallet/services/profile/service";
import { AccountService, Account } from "@/wallet/services/account/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { TaskService, StepContent, WrappedTask } from "@/wallet/services/task/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import { feeJuiceAddress, feeJuiceName, feeJuiceSymbol } from "@/wallet/utils/fee-juice";
import { getDefaultTokens } from "@/wallet/constants/default-tokens";
import { simulate, ViewFn } from "@/wallet/utils/fn";
import { privateFpcTokenName, privateFpcTokenSymbol } from "@/wallet/utils/private-fpc";
import { isPrivateFpcArtifact } from "@/wallet/services/fpc/handlers/private-fpc-handler";
import { FpcService } from "@/wallet/services/fpc/service";
import { FpcInfo, FpcType } from "@/wallet/services/fpc/spec";
import { Token, TokenInfo, TOKEN_SERVICE_NAME, TokenInterface, TokenMetadataOverride, Methods, Events } from "./spec";
import {
    BalanceOfPrivateFn,
    BalanceOfPublicFn,
    GetDecimalsFn,
    GetNameFn,
    GetSymbolFn,
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "./functions";
import { getTokenInfo, isTokenComplete } from "./utils";

export * from "./functions";
export * from "./spec";

// proper values for known contracts without on-chain metadata fns (Fee Juice, Private-FPC-shaped), placeholders otherwise
function getFallbackMetadata(contract: string, artifact: ContractArtifact): TokenInterface["fallbackMetadata"] {
    if (contract === feeJuiceAddress) {
        return { name: feeJuiceName, symbol: feeJuiceSymbol, decimals: 18 };
    }
    if (isPrivateFpcArtifact(artifact)) {
        return { name: privateFpcTokenName, symbol: privateFpcTokenSymbol, decimals: 18 };
    }
    return { name: "<name>", symbol: "<symbol>", decimals: 0 };
}

export class TokenService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = TOKEN_SERVICE_NAME;

    public readonly onTokenAdded = new EventHandler<TokenInfo>();
    public readonly onTokenUpdated = new EventHandler<TokenInfo>();
    public readonly onTokenDeleted = new EventHandler<TokenInfo>();

    private readonly tokens = new EntityStorage<Token>("azguard:core:tokens", StorageType.Local);
    private readonly lock = new Lock();

    private pxeService: PxeServiceClient = null!;
    private profiles: ProfileService = null!;
    private networks: NetworkService = null!;
    private accounts: AccountService = null!;
    private tasks: TaskService = null!;
    private fpcs: FpcService = null!;

    public constructor(logger: ILogger) {
        super(TOKEN_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profiles = services.get(ProfileService.name);
        this.networks = services.get(NetworkService.name);
        this.accounts = services.get(AccountService.name);
        this.tasks = services.get(TaskService.name);
        this.fpcs = services.get(FpcService.name);
        this.profiles.onProfileDeleted.add(this.onProfileDeleted);
        this.accounts.onAccountAdded.add(this.onAccountAdded);
        this.fpcs.onFpcAdded.add(this.onFpcAdded);
    }

    public async getTokens(profileId?: string, chainId?: number): Promise<TokenInfo[]> {
        return (await this.tokens.getValues())
            .filter(
                token =>
                    (profileId === undefined || token.profileId === profileId) &&
                    (chainId === undefined || token.chainId === chainId),
            )
            .map(getTokenInfo);
    }

    public async getTokensRaw(profileId?: string, chainId?: number): Promise<Token[]> {
        return (await this.tokens.getValues()).filter(
            token =>
                (profileId === undefined || token.profileId === profileId) &&
                (chainId === undefined || token.chainId === chainId),
        );
    }

    public async getToken(id: number): Promise<TokenInfo> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        return getTokenInfo(token);
    }

    public async getTokenRaw(id: number): Promise<Token> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        return token;
    }

    public async addToken(
        profileId: string,
        networkId: string,
        accountAddress: string,
        tokenInterface: TokenInterface,
        metadata?: TokenMetadataOverride,
        parentTask?: WrappedTask,
    ): Promise<TokenInfo> {
        await this.ensureInitialized();
        const stepContent = new StepContent("Adding token");
        const task = parentTask ? parentTask.startSubtask(stepContent) : this.tasks.startNewTask(stepContent);

        try {
            await this.lock.enter();
            let token = await this.findToken(profileId, tokenInterface.chainId, tokenInterface.contract);
            if (!token) {
                const [name, symbol, decimals] = await this.fetchTokenMetadata(
                    profileId,
                    networkId,
                    accountAddress,
                    tokenInterface,
                    metadata,
                );
                token = {
                    id: array_max((await this.tokens.getKeys()).map(x => +x)) + 1,
                    profileId,
                    chainId: tokenInterface.chainId,
                    contract: tokenInterface.contract,
                    name: name,
                    symbol: symbol,
                    decimals: decimals,
                    getNameFn: tokenInterface.getNameFn,
                    getSymbolFn: tokenInterface.getSymbolFn,
                    getDecimalsFn: tokenInterface.getDecimalsFn,
                    balanceOfPublicFn: tokenInterface.balanceOfPublicFn,
                    balanceOfPrivateFn: tokenInterface.balanceOfPrivateFn,
                    transferPublicFn: tokenInterface.transferPublicFn,
                    transferPrivateFn: tokenInterface.transferPrivateFn,
                    transferPublicToPrivateFn: tokenInterface.transferPublicToPrivateFn,
                    transferPrivateToPublicFn: tokenInterface.transferPrivateToPublicFn,
                };
                await this.tokens.set(`${token.id}`, token);
                this.emit("onTokenAdded", getTokenInfo(token));
            }
            const result = getTokenInfo(token);
            task.complete();
            return result;
        } catch (error) {
            task.fail(error);
            throw error;
        } finally {
            this.lock.leave();
        }
    }

    public async updateToken(
        profileId: string,
        networkId: string,
        accountAddress: string,
        tokenId: number,
        tokenInterface: TokenInterface,
    ): Promise<TokenInfo> {
        await this.ensureInitialized();
        const stepContent = new StepContent("Updating token");
        const task = this.tasks.startNewTask(stepContent);

        try {
            await this.lock.enter();
            const _token = await this.tokens.get(`${tokenId}`);
            if (!_token) {
                throw new Error("unknown token id");
            }
            if (
                _token.profileId !== profileId ||
                _token.chainId !== tokenInterface.chainId ||
                _token.contract !== tokenInterface.contract
            ) {
                throw new Error("token profile id, chain id and contract cannot change");
            }
            const [name, symbol, decimals] = await this.fetchTokenMetadata(
                profileId,
                networkId,
                accountAddress,
                tokenInterface,
            );
            const token: Token = {
                id: _token.id,
                profileId: _token.profileId,
                chainId: _token.chainId,
                contract: _token.contract,
                name: name,
                symbol: symbol,
                decimals: decimals,
                getNameFn: tokenInterface.getNameFn,
                getSymbolFn: tokenInterface.getSymbolFn,
                getDecimalsFn: tokenInterface.getDecimalsFn,
                balanceOfPublicFn: tokenInterface.balanceOfPublicFn,
                balanceOfPrivateFn: tokenInterface.balanceOfPrivateFn,
                transferPublicFn: tokenInterface.transferPublicFn,
                transferPrivateFn: tokenInterface.transferPrivateFn,
                transferPublicToPrivateFn: tokenInterface.transferPublicToPrivateFn,
                transferPrivateToPublicFn: tokenInterface.transferPrivateToPublicFn,
            };
            await this.tokens.set(`${token.id}`, token);
            this.emit("onTokenUpdated", getTokenInfo(token));
            const result = getTokenInfo(token);
            task.complete();
            return result;
        } catch (error) {
            task.fail(error);
            throw error;
        } finally {
            this.lock.leave();
        }
    }

    public async deleteToken(id: number): Promise<TokenInfo> {
        try {
            await this.lock.enter();
            const token = await this.tokens.get(`${id}`);
            if (!token) {
                throw new Error("unknown token id");
            }
            await this.tokens.delete(`${id}`);
            this.emit("onTokenDeleted", getTokenInfo(token));
            return getTokenInfo(token);
        } finally {
            this.lock.leave();
        }
    }

    public async getTokenInterface(networkId: string, tokenId: number): Promise<TokenInterface> {
        await this.ensureInitialized();
        const token = await this.tokens.get(`${tokenId}`);
        if (!token) {
            throw new Error("unknown token id");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = this.pxeService.getPXE(network);

        const instance = await pxe.getContractInstance(AztecAddress.fromStringUnsafe(token.contract));
        if (!instance) {
            throw new Error("contract instance not found");
        }

        const artifact = await pxe.getContractArtifact(instance.originalContractClassId);
        if (!artifact) {
            throw new Error("contract artifact not found");
        }

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === token.contract)) {
            await pxe.ensureContractRegistered({
                instance,
                artifact,
            });
        }

        const getNameFnCandidates = GetNameFn.getCandidates(artifact).map(x => x.getImpl());
        const getNameFn = token.getNameFn;

        const getSymbolFnCandidates = GetSymbolFn.getCandidates(artifact).map(x => x.getImpl());
        const getSymbolFn = token.getSymbolFn;

        const getDecimalsFnCandidates = GetDecimalsFn.getCandidates(artifact).map(x => x.getImpl());
        const getDecimalsFn = token.getDecimalsFn;

        const balanceOfPrivateFnCandidates = BalanceOfPrivateFn.getCandidates(artifact).map(x => x.getImpl());
        const balanceOfPrivateFn = token.balanceOfPrivateFn;

        const balanceOfPublicFnCandidates = BalanceOfPublicFn.getCandidates(artifact).map(x => x.getImpl());
        const balanceOfPublicFn = token.balanceOfPublicFn;

        const transferPublicFnCandidates = TransferPublicFn.getCandidates(artifact).map(x => x.getImpl());
        const transferPublicFn = token.transferPublicFn;

        const transferPrivateFnCandidates = TransferPrivateFn.getCandidates(artifact).map(x => x.getImpl());
        const transferPrivateFn = token.transferPrivateFn;

        const transferPrivateToPublicFnCandidates = TransferPrivateToPublicFn.getCandidates(artifact).map(x =>
            x.getImpl(),
        );
        const transferPrivateToPublicFn = token.transferPrivateToPublicFn;

        const transferPublicToPrivateFnCandidates = TransferPublicToPrivateFn.getCandidates(artifact).map(x =>
            x.getImpl(),
        );
        const transferPublicToPrivateFn = token.transferPublicToPrivateFn;

        const ti: TokenInterface = {
            chainId: token.chainId,
            contract: token.contract,
            getNameFn,
            getNameFnCandidates,
            getSymbolFn,
            getSymbolFnCandidates,
            getDecimalsFn,
            getDecimalsFnCandidates,
            balanceOfPublicFn,
            balanceOfPublicFnCandidates,
            balanceOfPrivateFn,
            balanceOfPrivateFnCandidates,
            transferPublicFn,
            transferPublicFnCandidates,
            transferPrivateFn,
            transferPrivateFnCandidates,
            transferPublicToPrivateFn,
            transferPublicToPrivateFnCandidates,
            transferPrivateToPublicFn,
            transferPrivateToPublicFnCandidates,
            fallbackMetadata: getFallbackMetadata(token.contract, artifact),
            isComplete: false,
        };
        ti.isComplete = isTokenComplete(ti);
        return ti;
    }

    public async parseTokenInterface(
        networkId: string,
        contract: string,
        parentTask?: WrappedTask,
    ): Promise<TokenInterface> {
        await this.ensureInitialized();
        const stepContent = new StepContent("Parsing token interface");
        const task = parentTask ? parentTask.startSubtask(stepContent) : this.tasks.startNewTask(stepContent);

        try {
            const network = await this.networks.getNetwork(networkId);
            if (!network) {
                throw new Error("unknown network id");
            }

            const pxe = this.pxeService.getPXE(network);

            const instance = await pxe.getContractInstance(AztecAddress.fromStringUnsafe(contract));
            if (!instance) {
                throw new Error("contract instance not found");
            }

            const artifact = await pxe.getContractArtifact(instance.originalContractClassId);
            if (!artifact) {
                throw new Error("contract artifact not found");
            }

            const registeredContracts = await pxe.getContracts();
            if (!registeredContracts.find(x => x.toString() === contract)) {
                await pxe.ensureContractRegistered({
                    instance,
                    artifact,
                });
            }

            const getNameFnCandidates = GetNameFn.getCandidates(artifact);
            const getNameFn = GetNameFn.getDefault(getNameFnCandidates);

            const getSymbolFnCandidates = GetSymbolFn.getCandidates(artifact);
            const getSymbolFn = GetSymbolFn.getDefault(getSymbolFnCandidates);

            const getDecimalsFnCandidates = GetDecimalsFn.getCandidates(artifact);
            const getDecimalsFn = GetDecimalsFn.getDefault(getDecimalsFnCandidates);

            const balanceOfPrivateFnCandidates = BalanceOfPrivateFn.getCandidates(artifact);
            const balanceOfPrivateFn = BalanceOfPrivateFn.getDefault(balanceOfPrivateFnCandidates);

            const balanceOfPublicFnCandidates = BalanceOfPublicFn.getCandidates(artifact);
            const balanceOfPublicFn = BalanceOfPublicFn.getDefault(balanceOfPublicFnCandidates);

            const transferPublicFnCandidates = TransferPublicFn.getCandidates(artifact);
            const transferPublicFn = TransferPublicFn.getDefault(transferPublicFnCandidates);

            const transferPrivateFnCandidates = TransferPrivateFn.getCandidates(artifact);
            const transferPrivateFn = TransferPrivateFn.getDefault(transferPrivateFnCandidates);

            const transferPrivateToPublicFnCandidates = TransferPrivateToPublicFn.getCandidates(artifact);
            const transferPrivateToPublicFn = TransferPrivateToPublicFn.getDefault(transferPrivateToPublicFnCandidates);

            const transferPublicToPrivateFnCandidates = TransferPublicToPrivateFn.getCandidates(artifact);
            const transferPublicToPrivateFn = TransferPublicToPrivateFn.getDefault(transferPublicToPrivateFnCandidates);

            const result: TokenInterface = {
                chainId: network.chainId,
                contract,
                getNameFn: getNameFn?.getImpl(),
                getNameFnCandidates: getNameFnCandidates.map(x => x.getImpl()),
                getSymbolFn: getSymbolFn?.getImpl(),
                getSymbolFnCandidates: getSymbolFnCandidates.map(x => x.getImpl()),
                getDecimalsFn: getDecimalsFn?.getImpl(),
                getDecimalsFnCandidates: getDecimalsFnCandidates.map(x => x.getImpl()),
                balanceOfPublicFn: balanceOfPublicFn?.getImpl(),
                balanceOfPublicFnCandidates: balanceOfPublicFnCandidates.map(x => x.getImpl()),
                balanceOfPrivateFn: balanceOfPrivateFn?.getImpl(),
                balanceOfPrivateFnCandidates: balanceOfPrivateFnCandidates.map(x => x.getImpl()),
                transferPublicFn: transferPublicFn?.getImpl(),
                transferPublicFnCandidates: transferPublicFnCandidates.map(x => x.getImpl()),
                transferPrivateFn: transferPrivateFn?.getImpl(),
                transferPrivateFnCandidates: transferPrivateFnCandidates.map(x => x.getImpl()),
                transferPublicToPrivateFn: transferPublicToPrivateFn?.getImpl(),
                transferPublicToPrivateFnCandidates: transferPublicToPrivateFnCandidates.map(x => x.getImpl()),
                transferPrivateToPublicFn: transferPrivateToPublicFn?.getImpl(),
                transferPrivateToPublicFnCandidates: transferPrivateToPublicFnCandidates.map(x => x.getImpl()),
                fallbackMetadata: getFallbackMetadata(contract, artifact),
                isComplete: false,
            };
            result.isComplete = isTokenComplete(result);
            task.complete();
            return result;
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async fetchTokenMetadata(
        profileId: string,
        networkId: string,
        address: string,
        ti: TokenInterface,
        metadata?: TokenMetadataOverride,
    ): Promise<[string, string, number]> {
        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);

        const node = await this.networks.getNode(network.chainId);
        const pxe = this.pxeService.getPXE(network);

        const getNameFn = ti.getNameFn ? GetNameFn.new(ti.getNameFn.name, ti.getNameFn.impl) : undefined;
        const getSymbolFn = ti.getSymbolFn ? GetSymbolFn.new(ti.getSymbolFn.name, ti.getSymbolFn.impl) : undefined;
        const getDecimalsFn = ti.getDecimalsFn
            ? GetDecimalsFn.new(ti.getDecimalsFn.name, ti.getDecimalsFn.impl)
            : undefined;

        const fallback = ti.fallbackMetadata;
        const fetchField = (fn: ViewFn | undefined, fallbackValue: string | number) =>
            fn ? simulate(node, pxe, account, ti.contract, fn, fn.buildArgs()) : fallbackValue;

        // per field: explicit override → on-chain view fn → fallback
        return await Promise.all([
            metadata?.name ?? fetchField(getNameFn, fallback.name),
            metadata?.symbol ?? fetchField(getSymbolFn, fallback.symbol),
            metadata?.decimals ?? fetchField(getDecimalsFn, fallback.decimals),
        ]);
    }

    private async findToken(profileId: string, chainId: number, contract: string): Promise<Token | undefined> {
        const tokens = await this.tokens.getValues();
        return tokens.find(
            token => token.profileId === profileId && token.chainId === chainId && token.contract === contract,
        );
    }

    private readonly onAccountAdded = async (account: Account) => {
        try {
            const networks = await this.networks.getNetworks(account.chainId);
            const network = networks.find(x => x.isDefault) ?? networks[0];
            if (!network) return;

            for (const { address } of getDefaultTokens(account.chainId)) {
                try {
                    const ti = await this.parseTokenInterface(network.id, address);
                    await this.addToken(account.profileId, network.id, account.address, ti);
                } catch (e) {
                    this.logDebug(`Failed to auto-add token ${address}: ${e}`);
                }
            }
        } catch (e) {
            this.logDebug(`Failed to auto-add default tokens: ${e}`);
        }
    };

    // A seeded Private FPC is invisible in the fee picker until its asset is a token.
    // Seeded records only: manual adds register the token in the popup with user-entered
    // name/symbol, and reacting here too would race that (fallback pFJ name would win).
    private readonly onFpcAdded = async (fpc: FpcInfo) => {
        if (fpc.source !== "seeded" || fpc.type !== FpcType.PrivateFpc || !fpc.asset) {
            return;
        }
        try {
            const [network, [account]] = await Promise.all([
                this.networks.getDefaultNetwork(fpc.chainId),
                this.accounts.getAccounts(fpc.profileId, fpc.chainId),
            ]);
            if (!network || !account) return;

            const ti = await this.parseTokenInterface(network.id, fpc.asset);
            await this.addToken(fpc.profileId, network.id, account.address, ti);
        } catch (e) {
            this.logDebug(`Failed to auto-add Private FPC token ${fpc.asset}: ${e}`);
        }
    };

    private readonly onProfileDeleted = async (profile: ProfileInfo) => {
        this.logDebug(`Profile ${profile.id} deleted, remove related tokens`);
        for (const token of (await this.tokens.getValues()).filter(x => x.profileId === profile.id)) {
            this.logDebug(`Remove token ${token.id}`);
            await this.deleteToken(token.id);
        }
    };

    public async backup(): Promise<Token[]> {
        const profile = await this.profiles.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        return (await this.getTokensRaw(profile.id));
    }

    public async restore(tokens: Token[]): Promise<Restored<Token>[]> {
        await this.ensureInitialized();

        const result: Restored<Token>[] = [];

        try {
            await this.lock.enter();

            let id = array_max((await this.tokens.getKeys()).map(x => +x)) + 1;
            for (const token of tokens) {
                try {
                    await this.tokens.set(`${id}`, { ...token, id });
                    result.push({ ...token, id });
                    id++;
                } catch (err) {
                    result.push({
                        ...token,
                        restoreError: err instanceof Error ? err.message : err,
                    });
                }
            }

            return result;
        } finally {
            this.lock.leave()
        }
    }
}
