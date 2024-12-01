import { createPXEClient, Fr, PXE, sleep, SyncStatus } from "@aztec/aztec.js"
import { poseidon2Hash } from "@aztec/foundation/crypto"
import {
	RequestMessage,
	ResponseMessage,
	EventMessage,
} from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import { NetworkService } from "@/wallet/services/network"
import { Network } from "@/wallet/services/network/client"
import { ProfileService } from "@/wallet/services/profile"
import { EntityStorage, StorageType } from "@/wallet/storage"
import { array_max } from "@/wallet/utils"
import {
	Account,
	ACCOUNT_SERVICE_NAME,
	AccountServiceEvent,
	AccountServiceEventMessage,
	AccountServiceMethod,
	AccountSyncStatus,
	AccountType,
	ChangeAccountNameRequest,
	ChangeAccountNameResponse,
	ChangeAccountVisibilityRequest,
	ChangeAccountVisibilityResponse,
	CreateAccountRequest,
	CreateAccountResponse,
	GetAccountRequest,
	GetAccountResponse,
	GetAccountsRequest,
	GetAccountsResponse,
} from "./client"
import { AzguardV0, IAccountContract } from "./contracts"

type AccountDto = {
	index: number
	type: AccountType
	name: string
	visible: boolean
}

export class AccountService extends Service {
	public readonly onAccountAdded: ((account: Account) => void)[] = []
	public readonly onAccountDeleted: ((account: Account) => void)[] = []
    
	private profile?: string = undefined
    private readonly pxes: Map<number, PXE> = new Map();
    private readonly addresses: Map<number, Set<string>> = new Map();
    private worker: Promise<void>;

    private readonly head: Map<number, number> = new Map();
    private readonly syncStatus: Map<number, SyncStatus> = new Map();

	constructor(
		private readonly profiles: ProfileService,
		private readonly networks: NetworkService,
		emit: (event: EventMessage) => void
	) {
		super(ACCOUNT_SERVICE_NAME, emit)
        this.profiles.onProfileDeleted.push(this.onProfileDeleted);
        this.worker = this.startWorker();
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
				console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
	}

	public async getAccounts(
		profileId: string,
		chainId: number,
		all?: boolean
	): Promise<Array<Account>> {
		const storage = this._getStorage(profileId, chainId)
		const accounts = await storage.getAll()
		return accounts
			.filter(([_, v]) => !!all || v.visible)
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
                        this.getSyncStatus(chainId, k),
					)
			)
	}

	public async getAccount(
		profileId: string,
		chainId: number,
		address: string
	): Promise<Account | undefined> {
		const storage = this._getStorage(profileId, chainId)
		const account = await storage.get(address)
		if (account !== undefined) {
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
                this.getSyncStatus(chainId, address),
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
		const storage = this._getStorage(profileId, chainId)
		const accounts = await storage.getValues()
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
		let address
		switch (type) {
			case AccountType.Azguard_v0:
				address = new AzguardV0(secret).address.toString()
				break
			default:
				throw new Error("unsupported account type")
		}

		await storage.set(address, { index, type, name, visible: true })
        if (!this.addresses.has(chainId)) {
            this.addresses.set(chainId, new Set());
        }
        this.addresses.get(chainId)!.add(address);
		return new Account(profileId, chainId, address, index, type, name, true)
	}

	public async changeAccountName(
		profileId: string,
		chainId: number,
		address: string,
		name: string
	): Promise<Account | undefined> {
		const storage = this._getStorage(profileId, chainId)
		const account = await storage.get(address)
		if (account !== undefined) {
			account.name = name
			await storage.set(address, account)
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
                this.getSyncStatus(chainId, address),
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
		const storage = this._getStorage(profileId, chainId)
		const account = await storage.get(address)
		if (account !== undefined) {
			account.visible = visible

			await storage.set(address, account)
			return new Account(
				profileId,
				chainId,
				address,
				account.index,
				account.type,
				account.name,
				account.visible,
                this.getSyncStatus(chainId, address),
			)
		}
		return undefined
	}

	public async signPayload(
		profileId: string,
		chainId: number,
		address: string,
		payload: string
	): Promise<string> {
		const storage = this._getStorage(profileId, chainId)
		const account = await storage.get(address)
		if (!account) {
			throw new Error("account doesn't exist")
		}
		switch (account.type) {
			case AccountType.Azguard_v0: {
				const secret = await this._deriveAccountSecret(
					profileId,
					chainId,
					account.type,
					account.index
				)
				return new AzguardV0(secret).signPayload(
					Buffer.from(payload, "hex")
				)
			}
			default:
				throw new Error("unsupported account type")
		}
	}

	public async getAccountContract(
		profileId: string,
		chainId: number,
		address: string
	): Promise<IAccountContract> {
		const storage = this._getStorage(profileId, chainId)
		const account = await storage.get(address)
		if (!account) {
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
				accountContract = new AzguardV0(secret)
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
        console.debug(`profile ${profileId} deleted, remove related accounts`);
        // TODO: rework accounts to not depend on networks and delete directly
        for (const network of await this.networks.getNetworks()) {
            const storage = this._getStorage(profileId, network.chainId);
            for (const address of await storage.getKeys()) {
                console.debug(`remove account ${address}`);
                await this.deleteAccount(profileId, network.chainId, address);
            }
        }
    }

	private async deleteAccount(
		profileId: string,
		chainId: number,
		address: string,
	) {
		const storage = this._getStorage(profileId, chainId)
		const dto = await storage.get(address)
        if (dto) {
            await storage.delete(address)
            this.addresses.get(chainId)?.delete(address);
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

	private _getStorage(
		profileId: string,
		chainId: number
	): EntityStorage<AccountDto> {
		return new EntityStorage(
			`azguard:core:accounts:${profileId}:${chainId}`,
			StorageType.Local
		)
	}

    private getSyncStatus(chainId: number, address: string): AccountSyncStatus | undefined {
        const head = this.head.get(chainId);
        const syncStatus = this.syncStatus.get(chainId);
        if (head === undefined || syncStatus?.notes[address] === undefined) {
            return undefined;
        }
        return new AccountSyncStatus(
            head,
            syncStatus.blocks,
            syncStatus.notes[address],
        );
    }

	private readonly onSessionOpened = async (profileId: string) => {
		this.profile = profileId
        for (const chainId of this.pxes.keys()) {
            const storage = this._getStorage(this.profile, chainId);
            if (!this.addresses.has(chainId)) {
                this.addresses.set(chainId, new Set());
            }
            for (const address of await storage.getKeys()) {
                this.addresses.get(chainId)!.add(address);
            }
        }
	}

	private readonly onSessionClosed = async () => {
		this.profile = undefined
	}

	private readonly onDefaultNetworkChanged = async (network: Network) => {
		this.pxes.set(network.chainId, createPXEClient(network.rpcUrl))
	}

	private async init() {
		while (true) {
			try {
                this.profile = (
					await this.profiles.readActiveProfile()
				)?.id

				for (const network of (
					await this.networks.getNetworks()
				).filter((x) => x.isDefault)) {
					this.pxes.set(
						network.chainId,
						createPXEClient(network.rpcUrl)
					)
				}

                if (this.profile) {
                    for (const chainId of this.pxes.keys()) {
                        const storage = this._getStorage(this.profile, chainId);
                        if (!this.addresses.has(chainId)) {
                            this.addresses.set(chainId, new Set());
                        }
                        for (const address of await storage.getKeys()) {
                            this.addresses.get(chainId)!.add(address);
                        }
                    }
                }

				this.profiles.onSessionOpened.push(this.onSessionOpened)
				this.profiles.onSessionClosed.push(this.onSessionClosed)
				this.networks.onDefaultNetworkChanged.push(
					this.onDefaultNetworkChanged
				)

				console.debug("Account service initialized")
				break
			} catch (error) {
				console.error(
					"Failed to initialize account service. Retry..."
				)
				await sleep(1000)
			}
		}
	}

	private async startWorker() {
		await this.init()
		while (true) {
			if (this.profile) {
                for (const [chainId, pxe] of this.pxes) {
                    const updated = new Set<string>();
                    const addresses = this.addresses.get(chainId);
                    if (addresses?.size) {
                        try {
                            const [head, syncStatus] = await Promise.all([
                                pxe.getBlockNumber(),
                                pxe.getSyncStatus(),
                            ])
                            for (const address of addresses.values()) {
                                if (syncStatus.notes[address] === undefined) {
                                    console.warn(`account ${address} not registered`);
                                    const account = await this.getAccountContract(this.profile, chainId, address);
                                    await account.register(pxe);
                                }
                                else {
                                    const current = this.getSyncStatus(chainId, address);
                                    if (current?.head !== head ||
                                        current?.blocks !== syncStatus.blocks ||
                                        current?.notes !== syncStatus.notes[address]
                                    ) {
                                        updated.add(address);
                                    }
                                }
                            }
                            this.head.set(chainId, head);
                            this.syncStatus.set(chainId, syncStatus);
                        } catch (error) {
                            console.error(`Failed to sync accounts for chain ${chainId}.`, error)
                            if (this.head.has(chainId) || this.syncStatus.has(chainId)) {
                                for (const address of addresses) {
                                    updated.add(address);
                                }
                            }
                            this.head.delete(chainId)
                            this.syncStatus.delete(chainId)
                        }
                    }
                    if (updated.size) {
                        try {
                            for (const account of (await this.getAccounts(this.profile, chainId, true)).filter(x => updated.has(x.address))) {
                                this.emit(new AccountServiceEventMessage(AccountServiceEvent.AccountUpdated, account));
                            }                            
                        }
                        catch (error) {
                            console.error("Failed to emit account status updated event.", error);
                        }
                    }
                }
                console.debug("Accounts synced.");
			}
			await sleep(5000)
		}
	}
}
