import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { ServiceCollection, ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import { ILogger } from "@/wallet/logger"
import { ProfileService } from "@/wallet/services/profile/service"
import { NetworkService, Network } from "@/wallet/services/network/service"
import { AccountService, Account } from "@/wallet/services/account/service"
import { DappSessionService, AccessLevel, DappSession } from "@/wallet/services/dapp-session/service"
import { ExecutionService, type Operation, type OperationKind } from "@/wallet/services/execution/service"
import { OriginType, type LocalTxOrigin } from "@/wallet/services/transaction/service"
import { getRandomHex, Lock } from "@/wallet/utils"
import { getErrorMessage } from "@/wallet/utils/errors"
import { EventHandler } from "@/wallet/utils/event-handler"
import {
	DAPP_INTERACTION_SERVICE_NAME,
	type ExecutionPayload,
	type ExecutionResult,
	type CapabilityPayload,
	type CapabilityParams,
	type CapabilityResult,
	type DiscoveryPayload,
	type DiscoveryParams,
	type DiscoveryResult,
	type ExecutionParams,
	type CaipChain,
	type CaipAccount,
	type OperationRequest,
	Methods,
	Events,
	DappInteraction,
} from "./spec"

export * from "./spec"

export class DappInteractionService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
	public static name = DAPP_INTERACTION_SERVICE_NAME

	public readonly onInteractionCancelled = new EventHandler<string>()

	private readonly storage: Map<string, DappInteraction> = new Map()
	private readonly lock = new Lock()

	private profileService: ProfileService = null!
	private networkService: NetworkService = null!
	private accountService: AccountService = null!
	private dappSessionService: DappSessionService = null!
	private executionService: ExecutionService = null!

	public constructor(logger: ILogger) {
		super(DAPP_INTERACTION_SERVICE_NAME, logger)
	}

	protected async init(services: ServiceCollection) {
		this.profileService = services.get(ProfileService.name)
		this.networkService = services.get(NetworkService.name)
		this.accountService = services.get(AccountService.name)
		this.dappSessionService = services.get(DappSessionService.name)
		this.executionService = services.get(ExecutionService.name)
	}

	public async getInteractionPayload(id: string): Promise<ExecutionPayload | CapabilityPayload | DiscoveryPayload> {
		const interactionRequest = this.storage.get(id)
		if (!interactionRequest) {
			throw new Error("Invalid id")
		}
		return interactionRequest.payload
	}

	public async approveInteraction(id: string, operations: Operation[], origin: LocalTxOrigin): Promise<void> {
		const interaction = this.storage.get(id)
		if (!interaction) {
			throw new Error("Invalid id")
		}
		this.storage.delete(id)
		this.executeAndResolve(interaction, operations, origin)
	}

	public async resolveInteraction(id: string, result: ExecutionResult | CapabilityResult | DiscoveryResult): Promise<void> {
		const interactionRequest = this.storage.get(id)
		if (!interactionRequest) {
			throw new Error("Invalid id")
		}
		this.storage.delete(id)
		interactionRequest.resolve(result)
	}

	public async rejectInteraction(id: string, reason: string): Promise<void> {
		const interactionRequest = this.storage.get(id)
		if (!interactionRequest) {
			return
		}
		this.storage.delete(id)
		interactionRequest.reject(reason)
	}

	private async executeAndResolve(interaction: DappInteraction, operations: Operation[], origin: LocalTxOrigin): Promise<void> {
		const kinds = operations.map((o) => o.kind).join(", ")
		this.logInfo(`executeAndResolve: starting [${kinds}] for ${origin.name}`)
		try {
			await this.profileService.refreshSession()
			const result = await this.executionService.executeOperations(operations, origin)
			this.logInfo(`executeAndResolve: resolved [${kinds}]`)
			interaction.resolve(result)
		} catch (error) {
			this.logError(`executeAndResolve: failed [${kinds}]`, getErrorMessage(error))
			interaction.reject(error instanceof Error ? error.message : "Execution failed")
		}
	}

	public cancelInteraction(cancellationToken: string) {
		const interaction = this.storage.values().find((x) => x.cancellationToken === cancellationToken)
		if (interaction) {
			this.emit("onInteractionCancelled", interaction.id)
		}
	}

	public async execute(params: ExecutionParams, cancellationToken?: string): Promise<ExecutionResult> {
		await this.ensureInitialized()
		const session = await this.validateSession(params)
		const payload: ExecutionPayload = { params, session }
		if (!(await this.isConfirmationNeeded(payload))) {
			return await this.silentInteraction(payload)
		}
		return (await this.interaction("execute", payload, cancellationToken)) as ExecutionResult
	}

	public async requestCapabilities(params: CapabilityParams, cancellationToken?: string): Promise<CapabilityResult> {
		await this.ensureInitialized()
		const session = await this.dappSessionService.getDappSession(params.sessionId)
		const payload: CapabilityPayload = { params, session }
		return (await this.interaction("capabilities", payload, cancellationToken)) as CapabilityResult
	}

	public async discover(params: DiscoveryParams, cancellationToken?: string): Promise<DiscoveryResult> {
		const payload: DiscoveryPayload = { params }
		return (await this.interaction("discover", payload, cancellationToken)) as DiscoveryResult
	}

	private async interaction(
		type: string,
		payload: ExecutionPayload | CapabilityPayload | DiscoveryPayload,
		cancellationToken?: string,
	): Promise<ExecutionResult | CapabilityResult | DiscoveryResult> {
		let interaction: DappInteraction
		let promise: Promise<ExecutionResult | CapabilityResult | DiscoveryResult>

		try {
			await this.lock.enter()

			let id: string
			do {
				id = getRandomHex(8)
			} while (this.storage.has(id))

			interaction = {
				id,
				payload,
				resolve: null!,
				reject: null!,
				cancellationToken: cancellationToken ?? id,
			}

			promise = new Promise<ConnectionResult | ExecutionResult | CapabilityResult | DiscoveryResult>((resolve, reject) => {
				interaction.resolve = resolve
				interaction.reject = reject
			})

			this.storage.set(id, interaction)
		} finally {
			this.lock.leave()
		}

		chrome.windows.create(
			{
				type: "popup",
				url: chrome.runtime.getURL(`src/popup/index.html#/windows/${type}?requestId=${interaction.id}`),
				height: 800,
				width: 400,
			},
			(createdWindow) => {
				if (!createdWindow?.id) return
				const windowId = createdWindow.id
				const onWindowClosed = (closedWindowId: number) => {
					if (closedWindowId !== windowId) return
					chrome.windows.onRemoved.removeListener(onWindowClosed)
					if (this.storage.has(interaction.id)) {
						this.storage.delete(interaction.id)
						interaction.reject("User closed the popup window")
					}
				}
				chrome.windows.onRemoved.addListener(onWindowClosed)
			},
		)

		return promise
	}

	private async silentInteraction(payload: ExecutionPayload): Promise<ExecutionResult> {
		const profile = await this.profileService.getActiveProfile()
		if (profile?.id !== payload.session.profileId) {
			throw new Error("Wallet locked")
		}
		const getNetwork = async (caipChain: CaipChain): Promise<Network> => {
			const [_, chainId] = caipChain.split(":")
			const networks = await this.networkService.getNetworks(+chainId)
			if (networks.length === 0) {
				throw new Error("Network no longer exists")
			}
			return networks.find((x) => x.isDefault) ?? networks[0]
		}
		const getNetworkAndAccount = async (caipAccount: CaipAccount): Promise<[Network, Account]> => {
			const [_, chainId, address] = caipAccount.split(":")
			const networks = await this.networkService.getNetworks(+chainId)
			if (networks.length === 0) {
				throw new Error("Network no longer exists")
			}
			const network = networks.find((x) => x.isDefault) ?? networks[0]
			const account = await this.accountService.getAccount(profile!.id, network.chainId, address)
			if (!account) {
				throw new Error("Account no longer exists")
			}
			return [network, account]
		}
		const operations: Operation[] = []
		for (const op of payload.params.operations) {
			switch (op.kind) {
				case "register_contract":
				case "register_sender":
				case "aztec_getContractClassMetadata":
				case "aztec_getContractMetadata":
				case "aztec_getChainInfo":
				case "aztec_registerSender":
				case "aztec_getAddressBook":
				case "aztec_registerContract":
				case "aztec_getPrivateEvents": {
					const network = await getNetwork(op.chain)
					operations.push({ ...op, networkId: network.id })
					break
				}
				case "get_complete_address":
				case "register_token":
				case "simulate_transaction":
				case "simulate_utility":
				case "simulate_views":
				case "aztec_simulateTx":
				case "aztec_executeUtility":
				case "aztec_profileTx":
				case "aztec_createAuthWit": {
					const [network, account] = await getNetworkAndAccount(op.account)
					operations.push({ ...op, networkId: network.id, accountAddress: account.address })
					break
				}
				case "aztec_sendTx":
				case "send_transaction": {
					const [network, account] = await getNetworkAndAccount(op.account)
					operations.push({
						...op,
						networkId: network.id,
						accountAddress: account.address,
						feeSettings: { paymentMethod: { kind: "embedded" } },
					})
					break
				}
				default: {
					throw new Error("Invalid operation kind")
				}
			}
		}
		await this.profileService.refreshSession()
		return await this.executionService.executeOperations(operations, {
			type: OriginType.DAPP,
			name: payload.session.dappMetadata.name ?? "Unknown dapp",
		})
	}

	private async validateSession({ sessionId, operations }: ExecutionParams): Promise<DappSession> {
		const session = await this.dappSessionService.tryGetDappSession(sessionId)
		if (!session) {
			throw new Error("Invalid session")
		}
		// validate permissions
		for (const operation of operations) {
			switch (operation.kind) {
				case "register_contract":
				case "register_sender":
				case "aztec_getContractClassMetadata":
				case "aztec_getContractMetadata":
				case "aztec_getChainInfo":
				case "aztec_registerSender":
				case "aztec_getAddressBook":
				case "aztec_registerContract": {
					this.checkMethodPermission(session, operation.kind, operation.chain)
					break
				}
				case "aztec_getPrivateEvents": {
					this.checkMethodPermission(session, operation.kind, operation.chain)
					this.checkScopesPermissions(session, operation.eventFilter.scopes)
					break
				}
				case "get_complete_address":
				case "register_token":
				case "simulate_utility":
				case "aztec_simulateTx":
				case "aztec_executeUtility":
				case "aztec_profileTx":
				case "aztec_sendTx":
				case "aztec_createAuthWit": {
					const chain = operation.account.substring(0, operation.account.lastIndexOf(":"))
					this.checkAccountPermission(session, operation.account)
					this.checkMethodPermission(session, operation.kind, chain)
					break
				}
				case "send_transaction":
				case "simulate_transaction": {
					const chain = operation.account.substring(0, operation.account.lastIndexOf(":"))
					this.checkAccountPermission(session, operation.account)
					this.checkMethodPermission(session, operation.kind, chain)
					operation.actions.forEach((x) => this.checkMethodPermission(session, x.kind, chain))
					break
				}
				case "simulate_views": {
					const chain = operation.account.substring(0, operation.account.lastIndexOf(":"))
					this.checkAccountPermission(session, operation.account)
					this.checkMethodPermission(session, operation.kind, chain)
					operation.calls.forEach((x) => this.checkMethodPermission(session, x.kind, chain))
					break
				}
			}
		}
		return session
	}

	private checkAccountPermission(session: DappSession, account: string) {
		if (!session.accounts.includes(account)) {
			throw new Error("Unauthorized account")
		}
	}

	private checkMethodPermission(session: DappSession, method: string, chain: string) {
		const matchingChain = session.permissions.find((x) => x.chains?.includes(chain))
		if (!matchingChain) {
			throw new Error("Unauthorized method/chain")
		}
		// Empty methods list means "all methods allowed" — wallet-SDK sessions use this,
		// capability enforcement handles authorization separately.
		// Non-empty methods list (legacy connect sessions) must be enforced.
		if (matchingChain.methods && matchingChain.methods.length > 0 && !matchingChain.methods.includes(method)) {
			throw new Error("Unauthorized method")
		}
	}

	private checkScopesPermissions(session: DappSession, scopes: AztecAddress[]) {
		for (const address of scopes.map((x) => x.toString())) {
			if (!session.accounts.some((x) => x.endsWith(address))) {
				throw new Error("Unauthorized scopes")
			}
		}
	}

	private async isConfirmationNeeded(payload: ExecutionPayload): Promise<boolean> {
		const profile = await this.profileService.getActiveProfile()
		if (profile?.id !== payload.session.profileId) {
			return true
		}
		const accessLevel = this.getAccessLevel(payload.params.operations)
		if (accessLevel >= payload.session.confirmationLevel) {
			return true
		}
		if (
			payload.params.operations.find(
				(x) =>
					(x.kind === "send_transaction" && x.fee?.embeddedFeePayment === undefined) ||
					(x.kind === "aztec_sendTx" && x.exec.feePayer === undefined),
			)
		) {
			return true
		}
		return false
	}

	private getAccessLevel(ops: OperationRequest[]): AccessLevel {
		let level = AccessLevel.None
		for (const op of ops) {
			level = Math.max(level, this.getOperationAccessLevel(op.kind))
		}
		return level
	}

	private getOperationAccessLevel(kind: OperationKind): AccessLevel {
		switch (kind) {
			case "register_token":
				return AccessLevel.AppState
			case "get_complete_address":
				return AccessLevel.PublicData
			case "register_contract":
				return AccessLevel.PxeState
			case "register_sender":
				return AccessLevel.PxeState
			case "simulate_transaction":
				return AccessLevel.PrivateData
			case "simulate_utility":
				return AccessLevel.PrivateData
			case "simulate_views":
				return AccessLevel.PrivateData
			case "send_transaction":
				return AccessLevel.Transactions
			case "aztec_getContractClassMetadata":
				return AccessLevel.PxeState
			case "aztec_getContractMetadata":
				return AccessLevel.PxeState
			case "aztec_getPrivateEvents":
				return AccessLevel.PrivateData
			case "aztec_getChainInfo":
				return AccessLevel.PublicData
			case "aztec_registerSender":
				return AccessLevel.PxeState
			case "aztec_getAddressBook":
				return AccessLevel.AppState
			case "aztec_registerContract":
				return AccessLevel.PxeState
			case "aztec_simulateTx":
				return AccessLevel.PrivateData
			case "aztec_executeUtility":
				return AccessLevel.PrivateData
			case "aztec_profileTx":
				return AccessLevel.PrivateData
			case "aztec_sendTx":
				return AccessLevel.Transactions
			case "aztec_createAuthWit":
				return AccessLevel.PrivateData
			default:
				return AccessLevel.None
		}
	}
}
