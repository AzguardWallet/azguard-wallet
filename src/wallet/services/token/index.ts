import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { NetworkService } from "@/wallet/services/network";
import { EntityStorage, StorageType } from "@/wallet/storage";
import {
    AddTokenRequest,
    AddTokenResponse,
    DeleteTokenRequest,
    DeleteTokenResponse,
    GetTokenRequest,
    GetTokenResponse,
    GetTokensRequest,
    GetTokensResponse,
    TokenInfo,
    TOKEN_SERVICE_NAME,
    TokenServiceEvent,
    TokenServiceEventMessage,
    TokenServiceMethod,
    UpdateTokenRequest,
    UpdateTokenResponse,
    TokenInterface,
    GetInterfaceRequest,
    GetInterfaceResponse,
    ParseInterfaceRequest,
    ParseInterfaceResponse
} from "./client";
import { AztecAddress, createPXEClient, PXE, TxReceipt, TxStatus } from "@aztec/aztec.js";
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
import { array_max, sleep } from "@/wallet/utils";
import { Fn, FnImpl, ViewFn } from "@/wallet/utils/fn";
import { AccountService } from "../account";
import { AzguardFunctionCall, IAccountContract } from "../account/contracts";
import { FunctionType } from "@aztec/foundation/abi";
import { extractReturnValues } from "@/wallet/utils/simulation";

type Token = {
    id: number,
    chainId: number,
    contract: string,

    name: string,
    symbol: string,
    decimals: number,

    getNameFn?: FnImpl,
    getSymbolFn?: FnImpl,
    getDecimalsFn?: FnImpl,
    balanceOfPublicFn?: FnImpl,
    balanceOfPrivateFn?: FnImpl,
    transferPublicFn?: FnImpl,
    transferPrivateFn?: FnImpl,
    transferPublicToPrivateFn?: FnImpl,
    transferPrivateToPublicFn?: FnImpl,
}

export class TokenService extends Service {
    private readonly tokens: EntityStorage<Token>;

    constructor(
        private readonly networks: NetworkService,
        private readonly accounts: AccountService,
        emit: (event: EventMessage) => void
    ) {
        super(TOKEN_SERVICE_NAME, emit);
        this.tokens = new EntityStorage("azguard:core:tokens", StorageType.Local);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case TokenServiceMethod.GetTokens: {
                const _request = request as GetTokensRequest;
                try {
                    return new GetTokensResponse(_request, await this.getTokens());
                }
                catch (error: any) {
                    return new GetTokensResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.GetToken: {
                const _request = request as GetTokenRequest;
                try {
                    const token = await this.getToken(_request.tokenId);
                    return new GetTokenResponse(_request, token);
                }
                catch (error: any) {
                    return new GetTokenResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.AddToken: {
                const _request = request as AddTokenRequest;
                try {
                    const token = await this.addToken(_request.tokenInterface);
                    this.emit(new TokenServiceEventMessage(TokenServiceEvent.TokenAdded, token));
                    return new AddTokenResponse(_request, token);
                }
                catch (error: any) {
                    return new AddTokenResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.UpdateToken: {
                const _request = request as UpdateTokenRequest;
                try {
                    const token = await this.updateToken(_request.tokenId, _request.tokenInterface);
                    this.emit(new TokenServiceEventMessage(TokenServiceEvent.TokenUpdated, token));
                    return new UpdateTokenResponse(_request, token);
                }
                catch (error: any) {
                    return new UpdateTokenResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.DeleteToken: {
                const _request = request as DeleteTokenRequest;
                try {
                    const token = await this.deleteToken(_request.tokenId);
                    this.emit(new TokenServiceEventMessage(TokenServiceEvent.TokenDeleted, token));
                    return new DeleteTokenResponse(_request, token);
                }
                catch (error: any) {
                    return new DeleteTokenResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.GetInterface: {
                const _request = request as GetInterfaceRequest;
                try {
                    const tokenInterface = await this.getTokenInterface(_request.profileId, _request.networkId, _request.address, _request.tokenId);
                    return new GetInterfaceResponse(_request, tokenInterface);
                }
                catch (error: any) {
                    return new GetInterfaceResponse(_request, undefined, error.message);
                }
            }
            case TokenServiceMethod.ParseInterface: {
                const _request = request as ParseInterfaceRequest;
                try {
                    const tokenInterface = await this.parseTokenInterface(_request.profileId, _request.networkId, _request.address, _request.contract);
                    return new ParseInterfaceResponse(_request, tokenInterface);
                }
                catch (error: any) {
                    return new ParseInterfaceResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    public async getTokens(chainId?: number): Promise<Array<TokenInfo>> {
        const tokens = await this.tokens.getAll();
        return tokens.filter(([_, dto]) => chainId === undefined || dto.chainId === chainId)
            .map(([_, token]) => this.getTokenInfo(token))
            .toSorted((a, b) => a.id - b.id);
    }

    public async getToken(id: number): Promise<TokenInfo> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        return this.getTokenInfo(token);
    }

    public async addToken(ti: TokenInterface): Promise<TokenInfo> {
        const _token = await this.findToken(ti.chainId, ti.contract);
        if (_token) {
            throw new Error("token already added");
        }
        const token: Token = {
            id: array_max((await this.tokens.getKeys()).map(x => +x)) + 1,
            chainId: ti.chainId,
            contract: ti.contract,
            name: ti.name,
            symbol: ti.symbol,
            decimals: ti.decimals,
            getNameFn: ti.getNameFn,
            getSymbolFn: ti.getSymbolFn,
            getDecimalsFn: ti.getDecimalsFn,
            balanceOfPublicFn: ti.balanceOfPublicFn,
            balanceOfPrivateFn: ti.balanceOfPrivateFn,
            transferPublicFn: ti.transferPublicFn,
            transferPrivateFn: ti.balanceOfPrivateFn,
            transferPublicToPrivateFn: ti.transferPublicToPrivateFn,
            transferPrivateToPublicFn: ti.transferPrivateToPublicFn,
        };
        await this.tokens.set(`${token.id}`, token);
        return this.getTokenInfo(token);
    }

    public async updateToken(id: number, ti: TokenInterface): Promise<TokenInfo> {
        const _token = await this.tokens.get(`${id}`);
        if (!_token) {
            throw new Error("unknown token id");
        }
        if (_token.chainId !== ti.chainId || _token.contract !== ti.contract) {
            throw new Error("token chain id and contract cannot change");
        }
        const token: Token = {
            id: _token.id,
            chainId: ti.chainId,
            contract: ti.contract,
            name: ti.name,
            symbol: ti.symbol,
            decimals: ti.decimals,
            getNameFn: ti.getNameFn,
            getSymbolFn: ti.getSymbolFn,
            getDecimalsFn: ti.getDecimalsFn,
            balanceOfPublicFn: ti.balanceOfPublicFn,
            balanceOfPrivateFn: ti.balanceOfPrivateFn,
            transferPublicFn: ti.transferPublicFn,
            transferPrivateFn: ti.balanceOfPrivateFn,
            transferPublicToPrivateFn: ti.transferPublicToPrivateFn,
            transferPrivateToPublicFn: ti.transferPrivateToPublicFn,
        }
        await this.tokens.set(`${token.id}`, token);
        return this.getTokenInfo(token);
    }

    public async deleteToken(id: number): Promise<TokenInfo> {
        const token = await this.getToken(id);
        if (!token) {
            throw new Error("unknown token id");
        }
        await this.tokens.delete(`${id}`);
        return token;
    }

    public async getTokenInterface(profileId: string, networkId: string, address: string, id: number): Promise<TokenInterface> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);

        const instance = await pxe.getContractInstance(AztecAddress.fromString(token.contract));
        if (!instance) {
            throw new Error("contract not found");
        }

        const artifact = await pxe.getContractArtifact(instance.contractClassId);
        if (!artifact) {
            throw new Error("contract class not registered");
        }       

        const getNameFnCandidates = GetNameFn.getCandidates(artifact);
        const getNameFn = token.getNameFn;

        const getSymbolFnCandidates = GetSymbolFn.getCandidates(artifact);
        const getSymbolFn = token.getSymbolFn;

        const getDecimalsFnCandidates = GetDecimalsFn.getCandidates(artifact);
        const getDecimalsFn = token.getDecimalsFn;

        const balanceOfPrivateFnCandidates = BalanceOfPrivateFn.getCandidates(artifact);
        const balanceOfPrivateFn = token.balanceOfPrivateFn;

        const balanceOfPublicFnCandidates = BalanceOfPublicFn.getCandidates(artifact);
        const balanceOfPublicFn = token.balanceOfPublicFn;

        const transferPublicFnCandidates = TransferPublicFn.getCandidates(artifact);
        const transferPublicFn = token.transferPublicFn;

        const transferPrivateFnCandidates = TransferPrivateFn.getCandidates(artifact);
        const transferPrivateFn = token.transferPrivateFn;

        const transferPrivateToPublicFnCandidates = TransferPrivateToPublicFn.getCandidates(artifact);
        const transferPrivateToPublicFn = token.transferPrivateToPublicFn;

        const transferPublicToPrivateFnCandidates = TransferPublicToPrivateFn.getCandidates(artifact);
        const transferPublicToPrivateFn = token.transferPublicToPrivateFn;

        const _getNameFn = getNameFn ? GetNameFn.new(getNameFn.name, getNameFn.impl) : undefined;
        const _getSymbolFn = getSymbolFn ? GetSymbolFn.new(getSymbolFn.name, getSymbolFn.impl) : undefined;
        const _getDecimalsFn = getDecimalsFn ? GetDecimalsFn.new(getDecimalsFn.name, getDecimalsFn.impl) : undefined;
        
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const [name, symbol, decimals] = await Promise.all([
            _getNameFn
                ? this.simulate(pxe, account, token.contract, _getNameFn, _getNameFn.buildArgs())
                : Promise.resolve("<name>"),
            _getSymbolFn
                ? this.simulate(pxe, account, token.contract, _getSymbolFn, _getSymbolFn.buildArgs())
                : Promise.resolve("<symbol>"),
            _getDecimalsFn
                ? this.simulate(pxe, account, token.contract, _getDecimalsFn, _getDecimalsFn.buildArgs())
                : Promise.resolve(0),
        ]);
    
        return new TokenInterface(
            token.chainId,
            token.contract,
            name,
            symbol,
            decimals,
            getNameFn,
            getNameFnCandidates.map(x => x.getImpl()),
            getSymbolFn,
            getSymbolFnCandidates.map(x => x.getImpl()),
            getDecimalsFn,
            getDecimalsFnCandidates.map(x => x.getImpl()),
            balanceOfPublicFn,
            balanceOfPublicFnCandidates.map(x => x.getImpl()),
            balanceOfPrivateFn,
            balanceOfPrivateFnCandidates.map(x => x.getImpl()),
            transferPublicFn,
            transferPublicFnCandidates.map(x => x.getImpl()),
            transferPrivateFn,
            transferPrivateFnCandidates.map(x => x.getImpl()),
            transferPublicToPrivateFn,
            transferPublicToPrivateFnCandidates.map(x => x.getImpl()),
            transferPrivateToPublicFn,
            transferPrivateToPublicFnCandidates.map(x => x.getImpl()),
        );
    }

    public async parseTokenInterface(profileId: string, networkId: string, address: string, contract: string): Promise<TokenInterface> {
        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }
        
        const pxe = createPXEClient(network.rpcUrl);

        const instance = await pxe.getContractInstance(AztecAddress.fromString(contract));
        if (!instance) {
            throw new Error("contract not found");
        }

        const artifact = await pxe.getContractArtifact(instance.contractClassId);
        if (!artifact) {
            throw new Error("contract class not registered");
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

        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const [name, symbol, decimals] = await Promise.all([
            getNameFn
                ? this.simulate(pxe, account, contract, getNameFn, getNameFn.buildArgs())
                : Promise.resolve("<name>"),
            getSymbolFn
                ? this.simulate(pxe, account, contract, getSymbolFn, getSymbolFn.buildArgs())
                : Promise.resolve("<symbol>"),
            getDecimalsFn
                ? this.simulate(pxe, account, contract, getDecimalsFn, getDecimalsFn.buildArgs())
                : Promise.resolve(0),
        ]);

        return new TokenInterface(
            network.chainId,
            contract,
            name,
            symbol,
            decimals,
            getNameFn?.getImpl(),
            getNameFnCandidates.map(x => x.getImpl()),
            getSymbolFn?.getImpl(),
            getSymbolFnCandidates.map(x => x.getImpl()),
            getDecimalsFn?.getImpl(),
            getDecimalsFnCandidates.map(x => x.getImpl()),
            balanceOfPublicFn?.getImpl(),
            balanceOfPublicFnCandidates.map(x => x.getImpl()),
            balanceOfPrivateFn?.getImpl(),
            balanceOfPrivateFnCandidates.map(x => x.getImpl()),
            transferPublicFn?.getImpl(),
            transferPublicFnCandidates.map(x => x.getImpl()),
            transferPrivateFn?.getImpl(),
            transferPrivateFnCandidates.map(x => x.getImpl()),
            transferPublicToPrivateFn?.getImpl(),
            transferPublicToPrivateFnCandidates.map(x => x.getImpl()),
            transferPrivateToPublicFn?.getImpl(),
            transferPrivateToPublicFnCandidates.map(x => x.getImpl()),
        );
    }

    public async getPublicBalance(profileId: string, networkId: string, address: string, id: number): Promise<bigint> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.balanceOfPublicFn) {
            return 0n;
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const viewFn = BalanceOfPublicFn.new(token.balanceOfPublicFn.name, token.balanceOfPublicFn.impl);
        const args = viewFn.buildArgs(address);

        return await this.simulate(pxe, account, token.contract, viewFn, args);
    }

    public async getPrivateBalance(profileId: string, networkId: string, address: string, id: number): Promise<bigint> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.balanceOfPrivateFn) {
            return 0n;
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const viewFn = BalanceOfPrivateFn.new(token.balanceOfPrivateFn.name, token.balanceOfPrivateFn.impl);
        const args = viewFn.buildArgs(address);

        return await this.simulate(pxe, account, token.contract, viewFn, args);
    }

    public async transferPublic(profileId: string, networkId: string, address: string, id: number, to: string, amount: bigint): Promise<string> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.transferPublicFn) {
            throw new Error("Token functionality missed");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const fn = TransferPublicFn.new(token.transferPublicFn.name, token.transferPublicFn.impl);
        const args = fn.buildArgs(address, to, amount);

        return await this.execute(pxe, account, token.contract, fn, args);
    }

    public async transferPrivate(profileId: string, networkId: string, address: string, id: number, to: string, amount: bigint): Promise<string> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.transferPrivateFn) {
            throw new Error("Token functionality missed");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const fn = TransferPrivateFn.new(token.transferPrivateFn.name, token.transferPrivateFn.impl);
        const args = fn.buildArgs(address, to, amount);

        return await this.execute(pxe, account, token.contract, fn, args);
    }

    public async transferPublicToPrivate(profileId: string, networkId: string, address: string, id: number, to: string, amount: bigint): Promise<string> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.transferPublicToPrivateFn) {
            throw new Error("Token functionality missed");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const fn = TransferPublicToPrivateFn.new(token.transferPublicToPrivateFn.name, token.transferPublicToPrivateFn.impl);
        const args = fn.buildArgs(address, to, amount);

        return await this.execute(pxe, account, token.contract, fn, args);
    }

    public async transferPrivateToPublic(profileId: string, networkId: string, address: string, id: number, to: string, amount: bigint): Promise<string> {
        const token = await this.tokens.get(`${id}`);
        if (!token) {
            throw new Error("unknown token id");
        }
        
        if (!token.transferPrivateToPublicFn) {
            throw new Error("Token functionality missed");
        }

        const network = await this.networks.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }

        const pxe = createPXEClient(network.rpcUrl);
        const account = await this.accounts.getAccountContract(profileId, network.chainId, address);
        const fn = TransferPrivateToPublicFn.new(token.transferPrivateToPublicFn.name, token.transferPrivateToPublicFn.impl);
        const args = fn.buildArgs(address, to, amount);

        return await this.execute(pxe, account, token.contract, fn, args);
    }

    private async findToken(chainId: number, contract: string): Promise<Token | undefined> {
        const tokens = await this.tokens.getAll();
        return tokens.find(([_, token]) => token.chainId === chainId && token.contract === contract)?.[1];
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
            !!token.transferPrivateToPublicFn,
        );
    }

    private async simulate(
        pxe: PXE,
        account: IAccountContract,
        contract: string,
        viewFn: ViewFn,
        args: any[],
    ): Promise<any> {
        if (viewFn.type === FunctionType.UNCONSTRAINED) {
            return await pxe.simulateUnconstrained(viewFn.name, args, AztecAddress.fromString(contract));
        }

        const packedArgs = viewFn.packArgs(args);
        const call = new AzguardFunctionCall(
            AztecAddress.fromString(contract),
            viewFn.selector,
            packedArgs.hash,
            viewFn.type === FunctionType.PUBLIC,
            viewFn.isStatic
        );

        const txRequest = await account.buildTxSimulationRequest(pxe, call, packedArgs);

        const tx = await pxe.simulateTx(txRequest, true);

        return viewFn.type === FunctionType.PUBLIC
            ? viewFn.unpackResult(extractReturnValues(tx.getPublicReturnValues()))
            : viewFn.unpackResult(extractReturnValues([tx.getPrivateReturnValues()]));
    }

    private async execute(
        pxe: PXE,
        account: IAccountContract,
        contract: string,
        fn: Fn,
        args: any[],
    ): Promise<string> {
        const packedArgs = fn.packArgs(args);
        const call = new AzguardFunctionCall(
            AztecAddress.fromString(contract),
            fn.selector,
            packedArgs.hash,
            fn.type === FunctionType.PUBLIC,
            fn.isStatic
        );

        const txRequest = await account.buildTxExecutionRequest(pxe, [call], [packedArgs]);

        const tx = await pxe.simulateTx(txRequest, true);
        const provenTx = await pxe.proveTx(txRequest, tx.privateExecutionResult);
        const txHash = await pxe.sendTx(provenTx.toTx());

        let tries = 100;
        let txReceipt: TxReceipt;
        do { await sleep(100); txReceipt = await pxe.getTxReceipt(txHash); }
        while (txReceipt.status === TxStatus.PENDING && --tries >= 0);

        return txReceipt.txHash.toString();
    }
}