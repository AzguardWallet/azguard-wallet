import { AztecAddress } from "@aztec/stdlib/aztec-address"
import type {
	EventMessage,
	RequestMessage,
	ResponseMessage,
} from "@/wallet/base/port-service/messages"
import { Service } from "@/wallet/base/port-service/service"
import type { NetworkService } from "@/wallet/services/network"
import type { ProfileService } from "@/wallet/services/profile"
import type { AccountService } from "@/wallet/services/account"
import { PxeServiceClient } from "@/wallet/services/pxe/client"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { array_max, Lock } from "@/wallet/utils"
import {
	feeJuiceAddress,
	feeJuiceName,
	feeJuiceSymbol,
} from "@/wallet/utils/fee-juice"
import { type FnImpl, simulate } from "@/wallet/utils/fn"
import {
	type AddTokenRequest,
	AddTokenResponse,
	type DeleteTokenRequest,
	DeleteTokenResponse,
	type GetTokenRequest,
	GetTokenResponse,
	type GetTokensRequest,
	GetTokensResponse,
	TokenInfo,
	TOKEN_SERVICE_NAME,
	TokenServiceEvent,
	TokenServiceEventMessage,
	TokenServiceMethod,
	type UpdateTokenRequest,
	UpdateTokenResponse,
	TokenInterface,
	type GetInterfaceRequest,
	GetInterfaceResponse,
	type ParseInterfaceRequest,
	ParseInterfaceResponse,
} from "./client"
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
} from "./functions"

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

export class TokenService extends Service {
	private readonly pxeService: PxeServiceClient;

	public readonly onTokenAdded: ((token: Token) => void)[] = []
	public readonly onTokenUpdated: ((token: Token) => void)[] = []
	public readonly onTokenDeleted: ((token: Token) => void)[] = []

	private readonly tokens: EntityStorage<Token>
	private readonly lock = new Lock();

	constructor(
		private readonly profiles: ProfileService,
		private readonly networks: NetworkService,
		private readonly accounts: AccountService,
		emit: (event: EventMessage) => void
	) {
		super(TOKEN_SERVICE_NAME, emit)
		this.pxeService = new PxeServiceClient();
		this.tokens = new EntityStorage(
			"azguard:core:tokens",
			StorageType.Local
		)
		this.profiles.onProfileDeleted.push(this.onProfileDeleted);
	}

	public async process(
		request: RequestMessage
	): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case TokenServiceMethod.GetTokens: {
				const _request = request as GetTokensRequest
				try {
					const tokens = await this.getTokens(_request.profileId, _request.chainId)
					return new GetTokensResponse(
						_request,
						tokens.map(this.getTokenInfo, this)
					)
				} catch (error: unknown) {
					return new GetTokensResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.GetToken: {
				const _request = request as GetTokenRequest
				try {
					const token = await this.getToken(_request.tokenId)
					return new GetTokenResponse(_request, token)
				} catch (error: unknown) {
					return new GetTokenResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.AddToken: {
				const _request = request as AddTokenRequest
				try {
					const token = await this.addToken(
						_request.profileId,
						_request.networkId,
						_request.address,
						_request.tokenInterface
					)
					return new AddTokenResponse(_request, token)
				} catch (error: unknown) {
					return new AddTokenResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.UpdateToken: {
				const _request = request as UpdateTokenRequest
				try {
					const token = await this.updateToken(
						_request.profileId,
						_request.networkId,
						_request.address,
						_request.tokenId,
						_request.tokenInterface
					)
					return new UpdateTokenResponse(_request, token)
				} catch (error: unknown) {
					return new UpdateTokenResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.DeleteToken: {
				const _request = request as DeleteTokenRequest
				try {
					const token = await this.deleteToken(_request.tokenId)
					return new DeleteTokenResponse(_request, token)
				} catch (error: unknown) {
					return new DeleteTokenResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.GetInterface: {
				const _request = request as GetInterfaceRequest
				try {
					const tokenInterface = await this.getTokenInterface(
						_request.networkId,
						_request.tokenId
					)
					return new GetInterfaceResponse(_request, tokenInterface)
				} catch (error: unknown) {
					return new GetInterfaceResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			case TokenServiceMethod.ParseInterface: {
				const _request = request as ParseInterfaceRequest
				try {
					const tokenInterface = await this.parseTokenInterface(
						_request.networkId,
						_request.contract
					)
					return new ParseInterfaceResponse(_request, tokenInterface)
				} catch (error: unknown) {
					return new ParseInterfaceResponse(
						_request,
						undefined,
						(error as Error)?.message ?? error as string ?? "Unknown error"
					)
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
	}

	public async getTokens(profileId?: string, chainId?: number): Promise<Array<Token>> {
		const tokens = await this.tokens.getValues()
		return tokens.filter(
			(token) =>
				(profileId === undefined || token.profileId === profileId) &&
				(chainId === undefined || token.chainId === chainId)
		)
	}

	public async getToken(id: number): Promise<TokenInfo> {
		const token = await this.tokens.get(`${id}`)
		if (!token) {
			throw new Error("unknown token id")
		}
		return this.getTokenInfo(token)
	}

	public async getTokenRaw(id: number): Promise<Token> {
		const token = await this.tokens.get(`${id}`)
		if (!token) {
			throw new Error("unknown token id")
		}
		return token
	}

	public async addToken(
		profileId: string,
		networkId: string,
		address: string,
		ti: TokenInterface
	): Promise<TokenInfo> {
		try {
			await this.lock.enter();
			let token = await this.findToken(profileId, ti.chainId, ti.contract)
			if (!token) {
				const [name, symbol, decimals] = await this.fetchTokenMetadata(profileId, networkId, address, ti);
				token = {
					id: array_max((await this.tokens.getKeys()).map((x) => +x)) + 1,
					profileId,
					chainId: ti.chainId,
					contract: ti.contract,
					name: name,
					symbol: symbol,
					decimals: decimals,
					getNameFn: ti.getNameFn,
					getSymbolFn: ti.getSymbolFn,
					getDecimalsFn: ti.getDecimalsFn,
					balanceOfPublicFn: ti.balanceOfPublicFn,
					balanceOfPrivateFn: ti.balanceOfPrivateFn,
					transferPublicFn: ti.transferPublicFn,
					transferPrivateFn: ti.transferPrivateFn,
					transferPublicToPrivateFn: ti.transferPublicToPrivateFn,
					transferPrivateToPublicFn: ti.transferPrivateToPublicFn,
				}
				await this.tokens.set(`${token.id}`, token)
				this.emitTokenAdded(token)
			}
			return this.getTokenInfo(token)
		}
		finally {
			this.lock.leave();
		}
	}

	public async updateToken(
		profileId: string,
		networkId: string,
		address: string,
		id: number,
		ti: TokenInterface
	): Promise<TokenInfo> {
		try {
			await this.lock.enter();
			const _token = await this.tokens.get(`${id}`)
			if (!_token) {
				throw new Error("unknown token id")
			}
			if (_token.profileId !== profileId || _token.chainId !== ti.chainId || _token.contract !== ti.contract) {
				throw new Error("token profile id, chain id and contract cannot change")
			}
			const [name, symbol, decimals] = await this.fetchTokenMetadata(profileId, networkId, address, ti);
			const token: Token = {
				id: _token.id,
				profileId: _token.profileId,
				chainId: _token.chainId,
				contract: _token.contract,
				name: name,
				symbol: symbol,
				decimals: decimals,
				getNameFn: ti.getNameFn,
				getSymbolFn: ti.getSymbolFn,
				getDecimalsFn: ti.getDecimalsFn,
				balanceOfPublicFn: ti.balanceOfPublicFn,
				balanceOfPrivateFn: ti.balanceOfPrivateFn,
				transferPublicFn: ti.transferPublicFn,
				transferPrivateFn: ti.transferPrivateFn,
				transferPublicToPrivateFn: ti.transferPublicToPrivateFn,
				transferPrivateToPublicFn: ti.transferPrivateToPublicFn,
			}
			await this.tokens.set(`${token.id}`, token)
			this.emitTokenUpdated(token)
			return this.getTokenInfo(token)
		}
		finally {
			this.lock.leave();
		}
	}

	public async deleteToken(id: number): Promise<TokenInfo> {
		try {
			await this.lock.enter();
			const token = await this.tokens.get(`${id}`)
			if (!token) {
				throw new Error("unknown token id")
			}
			await this.tokens.delete(`${id}`)
			this.emitTokenDeleted(token)
			return this.getTokenInfo(token)
		}
		finally {
			this.lock.leave();
		}
	}

	public async getTokenInterface(
		networkId: string,
		id: number
	): Promise<TokenInterface> {
		const token = await this.tokens.get(`${id}`)
		if (!token) {
			throw new Error("unknown token id")
		}

		const network = await this.networks.getNetwork(networkId)
		if (!network) {
			throw new Error("unknown network id")
		}

		const pxe = this.pxeService.getPXE(network);

		const contractMetadata = await pxe.getContractMetadata(AztecAddress.fromString(token.contract));
		if (!contractMetadata.contractInstance) {
			throw new Error("contract instance not found")
		}
		const instance = contractMetadata.contractInstance;

		const classMetadata = await pxe.getContractClassMetadata(instance.currentContractClassId);
		if (!classMetadata.artifact) {
			throw new Error("contract artifact not found")
		}
		const artifact = classMetadata.artifact;

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === token.contract)) {
            await pxe.registerContract({
                instance,
                artifact,
            });
        }

		const getNameFnCandidates = GetNameFn.getCandidates(artifact)
		const getNameFn = token.getNameFn

		const getSymbolFnCandidates = GetSymbolFn.getCandidates(artifact)
		const getSymbolFn = token.getSymbolFn

		const getDecimalsFnCandidates = GetDecimalsFn.getCandidates(artifact)
		const getDecimalsFn = token.getDecimalsFn

		const balanceOfPrivateFnCandidates =
			BalanceOfPrivateFn.getCandidates(artifact)
		const balanceOfPrivateFn = token.balanceOfPrivateFn

		const balanceOfPublicFnCandidates =
			BalanceOfPublicFn.getCandidates(artifact)
		const balanceOfPublicFn = token.balanceOfPublicFn

		const transferPublicFnCandidates =
			TransferPublicFn.getCandidates(artifact)
		const transferPublicFn = token.transferPublicFn

		const transferPrivateFnCandidates =
			TransferPrivateFn.getCandidates(artifact)
		const transferPrivateFn = token.transferPrivateFn

		const transferPrivateToPublicFnCandidates =
			TransferPrivateToPublicFn.getCandidates(artifact)
		const transferPrivateToPublicFn = token.transferPrivateToPublicFn

		const transferPublicToPrivateFnCandidates =
			TransferPublicToPrivateFn.getCandidates(artifact)
		const transferPublicToPrivateFn = token.transferPublicToPrivateFn

		return new TokenInterface(
			token.chainId,
			token.contract,
			getNameFn,
			getNameFnCandidates.map((x) => x.getImpl()),
			getSymbolFn,
			getSymbolFnCandidates.map((x) => x.getImpl()),
			getDecimalsFn,
			getDecimalsFnCandidates.map((x) => x.getImpl()),
			balanceOfPublicFn,
			balanceOfPublicFnCandidates.map((x) => x.getImpl()),
			balanceOfPrivateFn,
			balanceOfPrivateFnCandidates.map((x) => x.getImpl()),
			transferPublicFn,
			transferPublicFnCandidates.map((x) => x.getImpl()),
			transferPrivateFn,
			transferPrivateFnCandidates.map((x) => x.getImpl()),
			transferPublicToPrivateFn,
			transferPublicToPrivateFnCandidates.map((x) => x.getImpl()),
			transferPrivateToPublicFn,
			transferPrivateToPublicFnCandidates.map((x) => x.getImpl())
		)
	}

	public async parseTokenInterface(
		networkId: string,
		contract: string
	): Promise<TokenInterface> {
		const network = await this.networks.getNetwork(networkId)
		if (!network) {
			throw new Error("unknown network id")
		}

		const pxe = this.pxeService.getPXE(network);

		const contractMetadata = await pxe.getContractMetadata(AztecAddress.fromString(contract));
		if (!contractMetadata.contractInstance) {
			throw new Error("contract instance not found")
		}
		const instance = contractMetadata.contractInstance;

		const classMetadata = await pxe.getContractClassMetadata(instance.currentContractClassId);
		if (!classMetadata.artifact) {
			throw new Error("contract artifact not found")
		}
		const artifact = classMetadata.artifact;

        const registeredContracts = await pxe.getContracts();
        if (!registeredContracts.find(x => x.toString() === contract)) {
            await pxe.registerContract({
                instance,
                artifact,
            });
        }

		const getNameFnCandidates = GetNameFn.getCandidates(artifact)
		const getNameFn = GetNameFn.getDefault(getNameFnCandidates)

		const getSymbolFnCandidates = GetSymbolFn.getCandidates(artifact)
		const getSymbolFn = GetSymbolFn.getDefault(getSymbolFnCandidates)

		const getDecimalsFnCandidates = GetDecimalsFn.getCandidates(artifact)
		const getDecimalsFn = GetDecimalsFn.getDefault(getDecimalsFnCandidates)

		const balanceOfPrivateFnCandidates =
			BalanceOfPrivateFn.getCandidates(artifact)
		const balanceOfPrivateFn = BalanceOfPrivateFn.getDefault(
			balanceOfPrivateFnCandidates
		)

		const balanceOfPublicFnCandidates =
			BalanceOfPublicFn.getCandidates(artifact)
		const balanceOfPublicFn = BalanceOfPublicFn.getDefault(
			balanceOfPublicFnCandidates
		)

		const transferPublicFnCandidates =
			TransferPublicFn.getCandidates(artifact)
		const transferPublicFn = TransferPublicFn.getDefault(
			transferPublicFnCandidates
		)

		const transferPrivateFnCandidates =
			TransferPrivateFn.getCandidates(artifact)
		const transferPrivateFn = TransferPrivateFn.getDefault(
			transferPrivateFnCandidates
		)

		const transferPrivateToPublicFnCandidates =
			TransferPrivateToPublicFn.getCandidates(artifact)
		const transferPrivateToPublicFn = TransferPrivateToPublicFn.getDefault(
			transferPrivateToPublicFnCandidates
		)

		const transferPublicToPrivateFnCandidates =
			TransferPublicToPrivateFn.getCandidates(artifact)
		const transferPublicToPrivateFn = TransferPublicToPrivateFn.getDefault(
			transferPublicToPrivateFnCandidates
		)

		return new TokenInterface(
			network.chainId,
			contract,
			getNameFn?.getImpl(),
			getNameFnCandidates.map((x) => x.getImpl()),
			getSymbolFn?.getImpl(),
			getSymbolFnCandidates.map((x) => x.getImpl()),
			getDecimalsFn?.getImpl(),
			getDecimalsFnCandidates.map((x) => x.getImpl()),
			balanceOfPublicFn?.getImpl(),
			balanceOfPublicFnCandidates.map((x) => x.getImpl()),
			balanceOfPrivateFn?.getImpl(),
			balanceOfPrivateFnCandidates.map((x) => x.getImpl()),
			transferPublicFn?.getImpl(),
			transferPublicFnCandidates.map((x) => x.getImpl()),
			transferPrivateFn?.getImpl(),
			transferPrivateFnCandidates.map((x) => x.getImpl()),
			transferPublicToPrivateFn?.getImpl(),
			transferPublicToPrivateFnCandidates.map((x) => x.getImpl()),
			transferPrivateToPublicFn?.getImpl(),
			transferPrivateToPublicFnCandidates.map((x) => x.getImpl())
		)
	}

	private async fetchTokenMetadata(
		profileId: string,
		networkId: string,
		address: string,
		ti: TokenInterface
	): Promise<[string, string, number]> {
		const network = await this.networks.getNetwork(networkId)
		if (!network) {
			throw new Error("unknown network id")
		}

		const account = await this.accounts.getAccountContract(
			profileId,
			network.chainId,
			address
		)

        const pxe = this.pxeService.getPXE(network);

		const getNameFn = ti.getNameFn ? GetNameFn.new(ti.getNameFn.name, ti.getNameFn.impl) : undefined;
		const getSymbolFn = ti.getSymbolFn ? GetSymbolFn.new(ti.getSymbolFn.name, ti.getSymbolFn.impl) : undefined;
		const getDecimalsFn = ti.getDecimalsFn ? GetDecimalsFn.new(ti.getDecimalsFn.name, ti.getDecimalsFn.impl) : undefined;

		return [
			getNameFn
				? await simulate(
					pxe,
					account,
					ti.contract,
					getNameFn,
					getNameFn.buildArgs()
				)
				: ti.contract === feeJuiceAddress ? feeJuiceName : "<name>",
			getSymbolFn
				? await simulate(
					pxe,
					account,
					ti.contract,
					getSymbolFn,
					getSymbolFn.buildArgs()
				)
				: ti.contract === feeJuiceAddress ? feeJuiceSymbol : "<symbol>",
			getDecimalsFn
				? await simulate(
					pxe,
					account,
					ti.contract,
					getDecimalsFn,
					getDecimalsFn.buildArgs()
				)
				: 0,
		];
	}

	private async findToken(
		profileId: string,
		chainId: number,
		contract: string
	): Promise<Token | undefined> {
		const tokens = await this.tokens.getValues()
		return tokens.find(
			(token) => token.profileId === profileId && token.chainId === chainId && token.contract === contract
		)
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

	private emitTokenAdded(token: Token) {
		this.emit(
			new TokenServiceEventMessage(
				TokenServiceEvent.TokenAdded,
				this.getTokenInfo(token)
			)
		)
		for (const emit of this.onTokenAdded) {
			try {
				emit(token)
			} catch {}
		}
	}

	private emitTokenUpdated(token: Token) {
		this.emit(
			new TokenServiceEventMessage(
				TokenServiceEvent.TokenUpdated,
				this.getTokenInfo(token)
			)
		)
		for (const emit of this.onTokenUpdated) {
			try {
				emit(token)
			} catch {}
		}
	}

	private emitTokenDeleted(token: Token) {
		this.emit(
			new TokenServiceEventMessage(
				TokenServiceEvent.TokenDeleted,
				this.getTokenInfo(token)
			)
		)
		for (const emit of this.onTokenDeleted) {
			try {
				emit(token)
			} catch {}
		}
	}

    private readonly onProfileDeleted = async (profileId: string) => {
        console.debug(`profile ${profileId} deleted, remove related tokens`);
		for (const token of (await this.tokens.getValues()).filter(x => x.profileId === profileId)) {
			console.debug(`remove token ${token.id}`);
			await this.deleteToken(token.id);
		}
    }
}
