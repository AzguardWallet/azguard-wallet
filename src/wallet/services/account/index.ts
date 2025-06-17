import type { Fr } from "@aztec/foundation/fields"
import { poseidon2Hash } from "@aztec/foundation/crypto"
import type {
	RequestMessage,
	ResponseMessage,
	EventMessage,
} from "@/wallet/base/port-service/messages"
import { Service } from "@/wallet/base/port-service/service"
import type { NetworkService } from "@/wallet/services/network"
import type { ProfileService } from "@/wallet/services/profile"
import { type ILogs, LogLevel } from "@/wallet/services/logger/client";
import { EntityStorage, StorageType } from "@/wallet/storage"
import { array_max } from "@/wallet/utils"
import {
	Account,
	ACCOUNT_SERVICE_NAME,
	AccountServiceEvent,
	AccountServiceEventMessage,
	AccountServiceMethod,
	AccountType,
	type ChangeAccountNameRequest,
	ChangeAccountNameResponse,
	type ChangeAccountVisibilityRequest,
	ChangeAccountVisibilityResponse,
	type CreateAccountRequest,
	CreateAccountResponse,
	type GetAccountRequest,
	GetAccountResponse,
	type GetAccountsRequest,
	GetAccountsResponse,
} from "./client"
import { AzguardV0, type IAccountContract } from "./contracts"

type AccountDto = {
	profileId: string,
	chainId: number,
	index: number
	type: AccountType
	name: string
	visible: boolean
}

export class AccountService extends Service {
	public readonly onAccountAdded: ((account: Account) => void)[] = []
	public readonly onAccountDeleted: ((account: Account) => void)[] = []
	
	private readonly storage: EntityStorage<AccountDto>;

	constructor(
		private readonly profiles: ProfileService,
		private readonly networks: NetworkService,
		public readonly logger: ILogs,
		emit: (event: EventMessage) => void
	) {
		super(ACCOUNT_SERVICE_NAME, logger, emit)
		this.storage = new EntityStorage("azguard:core:accounts", StorageType.Local);
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
	}

	public async process(
		request: RequestMessage
	): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case AccountServiceMethod.GetAccounts: {
				const _request = request as GetAccountsRequest
				try {
					const accounts = await this.getAccounts(
						_request.profileId,
						_request.chainId,
						_request.all
					)
					return new GetAccountsResponse(_request, accounts)
				} catch (error: any) {
					return new GetAccountsResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case AccountServiceMethod.GetAccount: {
				const _request = request as GetAccountRequest
				try {
					const account = await this.getAccount(
						_request.profileId,
						_request.chainId,
						_request.address
					)
					return new GetAccountResponse(_request, account)
				} catch (error: any) {
					return new GetAccountResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case AccountServiceMethod.CreateAccount: {
				const _request = request as CreateAccountRequest
				try {
					const account = await this.createAccount(
						_request.profileId,
						_request.chainId,
						_request.accountType,
						_request.name
					)
					this.emit(
						new AccountServiceEventMessage(
							AccountServiceEvent.AccountAdded,
							account
						)
					)
					for (const emit of this.onAccountAdded) {
						try {
							emit(account)
						} catch {}
					}
					return new CreateAccountResponse(_request, account)
				} catch (error: any) {
					return new CreateAccountResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case AccountServiceMethod.ChangeAccountName: {
				const _request = request as ChangeAccountNameRequest
				try {
					const account = await this.changeAccountName(
						_request.profileId,
						_request.chainId,
						_request.address,
						_request.name
					)
					if (account) {
						this.emit(
							new AccountServiceEventMessage(
								AccountServiceEvent.AccountUpdated,
								account
							)
						)
					}
					return new ChangeAccountNameResponse(_request, account)
				} catch (error: any) {
					return new ChangeAccountNameResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			case AccountServiceMethod.ChangeAccountVisibility: {
				const _request = request as ChangeAccountVisibilityRequest
				try {
					const account = await this.changeAccountVisibility(
						_request.profileId,
						_request.chainId,
						_request.address,
						_request.visible
					)
					if (account) {
						this.emit(
							new AccountServiceEventMessage(
								AccountServiceEvent.AccountUpdated,
								account
							)
						)
					}
					return new ChangeAccountVisibilityResponse(
						_request,
						account
					)
				} catch (error: any) {
					return new ChangeAccountVisibilityResponse(
						_request,
						undefined,
						error.message
					)
				}
			}
			default: {
				this.log(LogLevel.Error, `Invalid request method ${request.method}.`)
				// console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
	}

	public async getAccounts(
		profileId: string,
		chainId: number,
		all?: boolean
	): Promise<Array<Account>> {
		return (await this.storage.getAll())
			.filter(([_, v]) =>
				v.profileId === profileId &&
				v.chainId === chainId &&
				(!!all || v.visible)
			)
			.map(
				([k, v]) =>
					new Account(
						profileId,
						chainId,
						k,
						v.index,
						v.type,
						v.name,
						v.visible,
					)
			)
	}

	public async getAccount(
		profileId: string,
		chainId: number,
		address: string
	): Promise<Account | undefined> {
		const account = await this.storage.get(address)
		if (account?.profileId === profileId && account.chainId === chainId) {
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
			)
		}
		return undefined
	}

	public async createAccount(
		profileId: string,
		chainId: number,
		type: AccountType,
		name: string
	): Promise<Account> {
		const accounts = (await this.storage.getValues())
			.filter(v => v.profileId === profileId && v.chainId === chainId);
		const index =
			accounts.length > 0
				? array_max(
						accounts
							.filter((x) => x.type === type)
							.map((x) => +x.index)
				  ) + 1
				: 0

		const secret = await this._deriveAccountSecret(
			profileId,
			chainId,
			type,
			index
		)
		let address: string
		switch (type) {
			case AccountType.Azguard_v0:
				address = (await AzguardV0.new(secret)).address.toString()
				break
			default:
				throw new Error("unsupported account type")
		}

		await this.storage.set(address, { profileId, chainId, index, type, name, visible: true })
		return new Account(profileId, chainId, address, index, type, name, true)
	}

	public async changeAccountName(
		profileId: string,
		chainId: number,
		address: string,
		name: string
	): Promise<Account | undefined> {
		const account = await this.storage.get(address)
		if (account?.profileId === profileId && account.chainId === chainId) {
			account.name = name
			await this.storage.set(address, account)
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
			)
		}
		return undefined
	}

	public async changeAccountVisibility(
		profileId: string,
		chainId: number,
		address: string,
		visible: boolean
	): Promise<Account | undefined> {
		const account = await this.storage.get(address)
		if (account?.profileId === profileId && account.chainId === chainId) {
			account.visible = visible

			await this.storage.set(address, account)
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
			)
		}
		return undefined
	}

	public async getAccountContract(
		profileId: string,
		chainId: number,
		address: string
	): Promise<IAccountContract> {
		const account = await this.storage.get(address)
		if (account?.profileId !== profileId || account.chainId !== chainId) {
			throw new Error("unknown account address")
		}

		let accountContract: IAccountContract
		switch (account.type) {
			case AccountType.Azguard_v0: {
				const secret = await this._deriveAccountSecret(
					profileId,
					chainId,
					account.type,
					account.index
				)
				accountContract = await AzguardV0.new(secret)
				break
			}
			default:
				throw new Error("unknown account type")
		}

		if (accountContract.address.toString() !== address) {
			throw new Error("account address inconsistency")
		}

		return accountContract
	}

    private readonly onProfileDeleted = async (profileId: string) => {
		this.log(LogLevel.Debug, `profile ${profileId} deleted, remove related accounts`)
        // console.debug(`profile ${profileId} deleted, remove related accounts`);
		const accounts = (await this.storage.getAll()).filter(([_, v]) => v.profileId === profileId);
		for (const [address, account] of accounts) {
			this.log(LogLevel.Debug, `remove account ${address}`)
			// console.debug(`remove account ${address}`);
			await this.deleteAccount(account.profileId, account.chainId, address);
		}
    }

	private async deleteAccount(
		profileId: string,
		chainId: number,
		address: string,
	) {
		const dto = await this.storage.get(address)
		if (dto?.profileId === profileId && dto.chainId === chainId) {
            await this.storage.delete(address)
            const account = new Account(
				profileId,
				chainId,
				address,
				dto.index,
				dto.type,
				dto.name,
				dto.visible
			)
            this.emit(new AccountServiceEventMessage(AccountServiceEvent.AccountDeleted, account))
            for (const emit of this.onAccountDeleted) {
                try {emit(account)} catch {}
            }
        }
	}

	private async _deriveAccountSecret(
		profileId: string,
		chainId: number,
		type: number,
		index: number
	): Promise<Fr> {
		const master = await this.profiles.getProfileSecret(profileId)
		if (!master) {
			throw new Error("unauthorized")
		}
		return poseidon2Hash([master, chainId, type, index])
	}
}
