import type { DappSession, DappMetadata } from "@/wallet/services/dapp-session/spec"
import type {
	GetCompleteAddressOperation,
	RegisterContractOperation,
	RegisterSenderOperation,
	RegisterTokenOperation,
	SimulateTransactionOperation,
	SendTransactionOperation,
	SimulateUtilityOperation,
	SimulateViewsOperation,
	Operation,
	OperationResult,
	AztecGetContractClassMetadataOperation,
	AztecGetContractMetadataOperation,
	AztecGetPrivateEventsOperation,
	AztecGetChainInfoOperation,
	AztecRegisterSenderOperation,
	AztecGetAddressBookOperation,
	AztecRegisterContractOperation,
	AztecSimulateTxOperation,
	AztecExecuteUtilityOperation,
	AztecProfileTxOperation,
	AztecSendTxOperation,
	AztecCreateAuthWitOperation,
} from "@/wallet/services/execution/spec"
import type { LocalTxOrigin } from "@/wallet/services/transaction/spec"

export const DAPP_INTERACTION_SERVICE_NAME = "dapp-interaction"

export type DappInteraction = {
	id: string
	payload: ExecutionPayload | CapabilityPayload | DiscoveryPayload
	resolve: (result: ExecutionResult | CapabilityResult | DiscoveryResult) => void
	reject: (reason: string) => void
	cancellationToken: string
}

export type ExecutionPayload = {
	params: ExecutionParams
	session: DappSession
}

export type ExecutionParams = {
	sessionId: string
	operations: OperationRequest[]
}

export type OperationRequest =
	// Vibeguard interface:
	| GetCompleteAddressRequest
	| RegisterContractRequest
	| RegisterSenderRequest
	| RegisterTokenRequest
	| SendTransactionRequest
	| SimulateTransactionRequest
	| SimulateUtilityRequest
	| SimulateViewsRequest
	// Aztec.js interface:
	| AztecGetContractClassMetadataRequest
	| AztecGetContractMetadataRequest
	| AztecGetPrivateEventsRequest
	| AztecGetChainInfoRequest
	| AztecRegisterSenderRequest
	| AztecGetAddressBookRequest
	| AztecRegisterContractRequest
	| AztecSimulateTxRequest
	| AztecExecuteUtilityRequest
	| AztecProfileTxRequest
	| AztecSendTxRequest
	| AztecCreateAuthWitRequest

export type CaipChain = `aztec:${number}`
export type CaipAccount = `${CaipChain}:${string}`

type NetworkParams = "networkId"
type AccountParams = NetworkParams | "accountAddress"
type SendParams = AccountParams | "feeSettings"

// Vibeguard interface:

export type GetCompleteAddressRequest = Omit<GetCompleteAddressOperation, AccountParams> & {
	account: CaipAccount
}

export type RegisterContractRequest = Omit<RegisterContractOperation, NetworkParams> & {
	chain: CaipChain
}

export type RegisterSenderRequest = Omit<RegisterSenderOperation, NetworkParams> & {
	chain: CaipChain
}

export type RegisterTokenRequest = Omit<RegisterTokenOperation, AccountParams> & {
	account: CaipAccount
}

export type SendTransactionRequest = Omit<SendTransactionOperation, SendParams> & {
	account: CaipAccount
}

export type SimulateTransactionRequest = Omit<SimulateTransactionOperation, AccountParams> & {
	account: CaipAccount
}

export type SimulateUtilityRequest = Omit<SimulateUtilityOperation, AccountParams> & {
	account: CaipAccount
}

export type SimulateViewsRequest = Omit<SimulateViewsOperation, AccountParams> & {
	account: CaipAccount
}

// Aztec.js interface:

export type AztecGetContractClassMetadataRequest = Omit<AztecGetContractClassMetadataOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecGetContractMetadataRequest = Omit<AztecGetContractMetadataOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecGetPrivateEventsRequest = Omit<AztecGetPrivateEventsOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecGetChainInfoRequest = Omit<AztecGetChainInfoOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecRegisterSenderRequest = Omit<AztecRegisterSenderOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecGetAddressBookRequest = Omit<AztecGetAddressBookOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecRegisterContractRequest = Omit<AztecRegisterContractOperation, NetworkParams> & {
	chain: CaipChain
}

export type AztecSimulateTxRequest = Omit<AztecSimulateTxOperation, AccountParams> & {
	account: CaipAccount
}

export type AztecExecuteUtilityRequest = Omit<AztecExecuteUtilityOperation, AccountParams> & {
	account: CaipAccount
}

export type AztecProfileTxRequest = Omit<AztecProfileTxOperation, AccountParams> & {
	account: CaipAccount
}

export type AztecSendTxRequest = Omit<AztecSendTxOperation, SendParams> & {
	account: CaipAccount
}

export type AztecCreateAuthWitRequest = Omit<AztecCreateAuthWitOperation, AccountParams> & {
	account: CaipAccount
}

export type ExecutionResult = OperationResult[]

export type CapabilityPayload = {
	params: CapabilityParams
	session: DappSession
}

export type CapabilityParams = {
	sessionId: string
	manifest: unknown
	delta: unknown[]
	existingGrants: unknown[]
	reRequested?: string[]
	availableAccounts?: Array<{ address: string; name: string; chainId: number }>
}

export type CapabilityResult = {
	granted: unknown[]
	selectedAccounts?: string[]
	accountAliases?: Record<string, string>
}

export type DiscoveryPayload = {
	params: DiscoveryParams
}

export type DiscoveryParams = {
	dappMetadata: DappMetadata
}

export type DiscoveryResult = {
	approved: boolean
}

export type Methods = {
	getInteractionPayload(id: string): ExecutionPayload | CapabilityPayload | DiscoveryPayload
	approveInteraction(id: string, operations: Operation[], origin: LocalTxOrigin): void
	resolveInteraction(id: string, result: ExecutionResult | CapabilityResult | DiscoveryResult): void
	rejectInteraction(id: string, reason: string): void
}

export type Events = {
	onInteractionCancelled: string
}
