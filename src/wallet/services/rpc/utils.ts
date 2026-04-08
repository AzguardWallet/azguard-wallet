import type { DappPermissions } from "@/wallet/services/dapp-session/spec"
import type {
	Action,
	AddCapsuleAction,
	AddExtraArgsAction,
	AddPrivateAuthwitAction,
	AddPublicAuthwitAction,
	CallAction,
	EncodedCallAction,
	AuthwitContent,
	CallAuthwitContent,
	EncodedCallAuthwitContent,
	IntentAuthwitContent,
	MessageHashAuthwitContent,
} from "@/wallet/services/execution/models"
import type {
	ExecutionParams,
	CaipChain,
	CaipAccount,
	OperationRequest,
	GetCompleteAddressRequest,
	RegisterContractRequest,
	RegisterSenderRequest,
	RegisterTokenRequest,
	SendTransactionRequest,
	SimulateTransactionRequest,
	SimulateUtilityRequest,
	SimulateViewsRequest,
	AztecGetContractClassMetadataRequest,
	AztecGetContractMetadataRequest,
	AztecGetPrivateEventsRequest,
	AztecGetChainInfoRequest,
	AztecRegisterSenderRequest,
	AztecGetAddressBookRequest,
	AztecRegisterContractRequest,
	AztecSimulateTxRequest,
	AztecExecuteUtilityRequest,
	AztecProfileTxRequest,
	AztecSendTxRequest,
	AztecCreateAuthWitRequest,
} from "@/wallet/services/dapp-interaction/spec"
import { RpcEvent /*, RpcMethod*/ } from "./types"

export function parseDappPermissions(data: unknown): DappPermissions {
	return {
		chains: parseOptionalArrayProp(data, "chains", parseChain),
		methods: parseOptionalArrayProp(data, "methods", parseMethod),
		events: parseOptionalArrayProp(data, "events", parseEvent),
	}
}

export function parseMethod(data: unknown): string {
	switch (data) {
		// rpc methods
		// case RpcMethod.get_wallet_info:
		// case RpcMethod.get_session:
		// case RpcMethod.close_session:
		// case RpcMethod.connect:
		// case RpcMethod.execute:
		// operations
		case "get_complete_address":
		case "register_sender":
		case "register_token":
		case "register_contract":
		case "send_transaction":
		case "simulate_transaction":
		case "simulate_utility":
		case "simulate_views":
		case "aztec_getContractClassMetadata":
		case "aztec_getContractMetadata":
		case "aztec_getPrivateEvents":
		case "aztec_getChainInfo":
		case "aztec_registerSender":
		case "aztec_getAddressBook":
		case "aztec_registerContract":
		case "aztec_simulateTx":
		case "aztec_executeUtility":
		case "aztec_profileTx":
		case "aztec_sendTx":
		case "aztec_createAuthWit":
		// actions
		case "add_capsule":
		case "add_extra_args":
		case "add_private_authwit":
		case "add_public_authwit":
		case "call":
		case "encoded_call":
			return data
		default:
			throw new Error(`Invalid method: ${JSON.stringify(data)}`)
	}
}

export function parseEvent(data: unknown): string {
	switch (data) {
		case RpcEvent.session_updated:
		case RpcEvent.session_closed:
			return data
		default:
			throw new Error("Invalid event")
	}
}

export function parseExecutionParams(data: unknown): ExecutionParams {
	if (!data) {
		throw new Error("Invalid execution params")
	}
	return {
		sessionId: parseStringProp(data, "sessionId"),
		operations: parseArrayProp(data, "operations", parseOperation),
	}
}

function parseOperation(op: unknown): OperationRequest {
	const { kind } = op as Record<string, unknown>
	switch (kind) {
		case "get_complete_address": {
			return parseGetCompleteAddressRequest(op)
		}
		case "register_contract": {
			return parseRegisterContractRequest(op)
		}
		case "register_sender": {
			return parseRegisterSenderRequest(op)
		}
		case "register_token": {
			return parseRegisterTokenRequest(op)
		}
		case "send_transaction": {
			return parseSendTransactionRequest(op)
		}
		case "simulate_transaction": {
			return parseSimulateTransactionRequest(op)
		}
		case "simulate_utility": {
			return parseSimulateUtilityRequest(op)
		}
		case "simulate_views": {
			return parseSimulateViewsRequest(op)
		}
		case "aztec_getContractClassMetadata": {
			return parseAztecGetContractClassMetadataRequest(op)
		}
		case "aztec_getContractMetadata": {
			return parseAztecGetContractMetadataRequest(op)
		}
		case "aztec_getPrivateEvents": {
			return parseAztecGetPrivateEventsRequest(op)
		}
		case "aztec_getChainInfo": {
			return parseAztecGetChainInfoRequest(op)
		}
		case "aztec_registerSender": {
			return parseAztecRegisterSenderRequest(op)
		}
		case "aztec_getAddressBook": {
			return parseAztecGetAddressBookRequest(op)
		}
		case "aztec_registerContract": {
			return parseAztecRegisterContractRequest(op)
		}
		case "aztec_simulateTx": {
			return parseAztecSimulateTxRequest(op)
		}
		case "aztec_executeUtility": {
			return parseAztecExecuteUtilityRequest(op)
		}
		case "aztec_profileTx": {
			return parseAztecProfileTxRequest(op)
		}
		case "aztec_sendTx": {
			return parseAztecSendTxRequest(op)
		}
		case "aztec_createAuthWit": {
			return parseAztecCreateAuthWitRequest(op)
		}
		default: {
			throw new Error("Invalid operation")
		}
	}
}

function parseGetCompleteAddressRequest(data: unknown): GetCompleteAddressRequest {
	return {
		kind: "get_complete_address",
		account: parseAccountProp(data, "account"),
	}
}

function parseRegisterContractRequest(data: unknown): RegisterContractRequest {
	const obj = data as Record<string, unknown>
	return {
		kind: "register_contract",
		chain: parseChainProp(data, "chain"),
		address: parseStringProp(data, "address"),
		instance: obj.instance, // TODO: implement validation
		artifact: obj.artifact, // TODO: implement validation
	}
}

function parseRegisterSenderRequest(data: unknown): RegisterSenderRequest {
	return {
		kind: "register_sender",
		chain: parseChainProp(data, "chain"),
		address: parseStringProp(data, "address"),
	}
}

function parseRegisterTokenRequest(data: unknown): RegisterTokenRequest {
	return {
		kind: "register_token",
		account: parseAccountProp(data, "account"),
		address: parseStringProp(data, "address"),
	}
}

function parseSendTransactionRequest(data: unknown): SendTransactionRequest {
	return {
		kind: "send_transaction",
		account: parseAccountProp(data, "account"),
		actions: parseArrayProp(data, "actions", parseAction),
		fee: parseOptionalProp(data, "fee"),
	}
}

function parseSimulateTransactionRequest(data: unknown): SimulateTransactionRequest {
	return {
		kind: "simulate_transaction",
		account: parseAccountProp(data, "account"),
		actions: parseArrayProp(data, "actions", parseAction),
		fee: parseOptionalProp(data, "fee"),
		simulatePublic: parseOptionalBooleanProp(data, "simulatePublic"),
	}
}

function parseSimulateUtilityRequest(data: unknown): SimulateUtilityRequest {
	return {
		kind: "simulate_utility",
		account: parseAccountProp(data, "account"),
		contract: parseStringProp(data, "contract"),
		method: parseStringProp(data, "method"),
		args: parseArrayProp(data, "args"),
	}
}

function parseSimulateViewsRequest(data: unknown): SimulateViewsRequest {
	return {
		kind: "simulate_views",
		account: parseAccountProp(data, "account"),
		calls: parseArrayProp(data, "calls", parseAction).filter((x) => x.kind === "call" || x.kind === "encoded_call"),
	}
}

function parseAztecGetContractClassMetadataRequest(data: unknown): AztecGetContractClassMetadataRequest {
	return {
		kind: "aztec_getContractClassMetadata",
		chain: parseChainProp(data, "chain"),
		id: parseRequiredProp(data, "id"),
	}
}

function parseAztecGetContractMetadataRequest(data: unknown): AztecGetContractMetadataRequest {
	return {
		kind: "aztec_getContractMetadata",
		chain: parseChainProp(data, "chain"),
		address: parseRequiredProp(data, "address"),
	}
}

function parseAztecGetPrivateEventsRequest(data: unknown): AztecGetPrivateEventsRequest {
	return {
		kind: "aztec_getPrivateEvents",
		chain: parseChainProp(data, "chain"),
		eventMetadata: parseRequiredProp(data, "eventMetadata"),
		eventFilter: parseRequiredProp(data, "eventFilter"),
	}
}

function parseAztecGetChainInfoRequest(data: unknown): AztecGetChainInfoRequest {
	return {
		kind: "aztec_getChainInfo",
		chain: parseChainProp(data, "chain"),
	}
}

function parseAztecRegisterSenderRequest(data: unknown): AztecRegisterSenderRequest {
	return {
		kind: "aztec_registerSender",
		chain: parseChainProp(data, "chain"),
		address: parseRequiredProp(data, "address"),
	}
}

function parseAztecGetAddressBookRequest(data: unknown): AztecGetAddressBookRequest {
	return {
		kind: "aztec_getAddressBook",
		chain: parseChainProp(data, "chain"),
	}
}

function parseAztecRegisterContractRequest(data: unknown): AztecRegisterContractRequest {
	return {
		kind: "aztec_registerContract",
		chain: parseChainProp(data, "chain"),
		instance: parseRequiredProp(data, "instance"),
		artifact: parseOptionalProp(data, "artifact"),
		secretKey: parseOptionalProp(data, "secretKey"),
	}
}

function parseAztecSimulateTxRequest(data: unknown): AztecSimulateTxRequest {
	return {
		kind: "aztec_simulateTx",
		account: parseAccountProp(data, "account"),
		exec: parseRequiredProp(data, "exec"),
		opts: parseRequiredProp(data, "opts"),
	}
}

function parseAztecExecuteUtilityRequest(data: unknown): AztecExecuteUtilityRequest {
	return {
		kind: "aztec_executeUtility",
		account: parseAccountProp(data, "account"),
		call: parseRequiredProp(data, "call"),
		opts: parseRequiredProp(data, "opts"),
	}
}

function parseAztecProfileTxRequest(data: unknown): AztecProfileTxRequest {
	return {
		kind: "aztec_profileTx",
		account: parseAccountProp(data, "account"),
		exec: parseRequiredProp(data, "exec"),
		opts: parseRequiredProp(data, "opts"),
	}
}

function parseAztecSendTxRequest(data: unknown): AztecSendTxRequest {
	return {
		kind: "aztec_sendTx",
		account: parseAccountProp(data, "account"),
		exec: parseRequiredProp(data, "exec"),
		opts: parseRequiredProp(data, "opts"),
	}
}

function parseAztecCreateAuthWitRequest(data: unknown): AztecCreateAuthWitRequest {
	return {
		kind: "aztec_createAuthWit",
		account: parseAccountProp(data, "account"),
		messageHashOrIntent: parseRequiredProp(data, "messageHashOrIntent"),
	}
}

function parseAction(data: unknown): Action {
	const { kind } = (data ?? {}) as Record<string, unknown>
	switch (kind) {
		case "add_capsule": {
			return parseAddCapsuleAction(data)
		}
		case "add_extra_args": {
			return parseAddExtraArgsAction(data)
		}
		case "add_private_authwit": {
			return parseAddPrivateAuthwitAction(data)
		}
		case "add_public_authwit": {
			return parseAddPublicAuthwitAction(data)
		}
		case "call": {
			return parseCallAction(data)
		}
		case "encoded_call": {
			return parseEncodedCallAction(data)
		}
		default: {
			throw new Error("Invalid action")
		}
	}
}

function parseAddCapsuleAction(data: unknown): AddCapsuleAction {
	const obj = data as Record<string, unknown>
	return {
		kind: "add_capsule",
		contract: parseStringProp(data, "contract"),
		storageSlot: parseStringProp(data, "storageSlot"),
		capsule: parseArrayProp(data, "capsule", parseString),
		scope: obj.scope != null ? parseStringProp(data, "scope") : undefined,
	}
}

function parseAddExtraArgsAction(data: unknown): AddExtraArgsAction {
	return {
		kind: "add_extra_args",
		args: parseArrayProp(data, "args", parseString),
	}
}

function parseAddPrivateAuthwitAction(data: unknown): AddPrivateAuthwitAction {
	const obj = data as Record<string, unknown>
	return {
		kind: "add_private_authwit",
		content: parseAuthwitContent(obj.content),
		authwit: parseOptionalArrayProp(data, "authwit", parseString),
	}
}

function parseAddPublicAuthwitAction(data: unknown): AddPublicAuthwitAction {
	const obj = data as Record<string, unknown>
	return {
		kind: "add_public_authwit",
		content: parseAuthwitContent(obj.content),
	}
}

function parseCallAction(data: unknown): CallAction {
	return {
		kind: "call",
		contract: parseStringProp(data, "contract"),
		method: parseStringProp(data, "method"),
		args: parseArrayProp(data, "args"),
		hideSender: parseOptionalBooleanProp(data, "hideSender"),
	}
}

function parseEncodedCallAction(data: unknown): EncodedCallAction {
	return {
		kind: "encoded_call",
		to: parseStringProp(data, "to"),
		name: parseOptionalStringProp(data, "name"),
		selector: parseStringProp(data, "selector"),
		type: parseOptionalStringProp(data, "type"),
		hideMsgSender: parseOptionalBooleanProp(data, "hideMsgSender"),
		isStatic: parseOptionalBooleanProp(data, "isStatic"),
		args: parseArrayProp(data, "args", parseString),
		returnTypes: parseOptionalArrayProp(data, "returnTypes"),
	}
}

function parseAuthwitContent(data: unknown): AuthwitContent {
	const { kind } = (data ?? {}) as Record<string, unknown>
	switch (kind) {
		case "call": {
			return parseCallAuthwitContent(data)
		}
		case "encoded_call": {
			return parseEncodedCallAuthwitContent(data)
		}
		case "intent": {
			return parseIntentAuthwitContent(data)
		}
		case "message_hash": {
			return parseMessageHashAuthwitContent(data)
		}
		default: {
			throw new Error("Invalid authwit content")
		}
	}
}

function parseCallAuthwitContent(data: unknown): CallAuthwitContent {
	return {
		kind: "call",
		caller: parseStringProp(data, "caller"),
		contract: parseStringProp(data, "contract"),
		method: parseStringProp(data, "method"),
		args: parseArrayProp(data, "args"),
		hideSender: parseOptionalBooleanProp(data, "hideSender"),
	}
}

function parseEncodedCallAuthwitContent(data: unknown): EncodedCallAuthwitContent {
	return {
		kind: "encoded_call",
		caller: parseStringProp(data, "caller"),
		to: parseStringProp(data, "to"),
		name: parseOptionalStringProp(data, "name"),
		selector: parseStringProp(data, "selector"),
		type: parseOptionalStringProp(data, "type"),
		hideMsgSender: parseOptionalBooleanProp(data, "hideMsgSender"),
		isStatic: parseOptionalBooleanProp(data, "isStatic"),
		args: parseArrayProp(data, "args", parseString),
		returnTypes: parseOptionalArrayProp(data, "returnTypes"),
	}
}

function parseIntentAuthwitContent(data: unknown): IntentAuthwitContent {
	return {
		kind: "intent",
		consumer: parseStringProp(data, "consumer"),
		intent: parseArrayProp(data, "intent", parseString),
	}
}

function parseMessageHashAuthwitContent(data: unknown): MessageHashAuthwitContent {
	return {
		kind: "message_hash",
		messageHash: parseStringProp(data, "messageHash"),
	}
}

function parseOptionalArrayProp<T>(data: unknown, prop: string, parseItem?: (item: unknown) => T): T[] | undefined {
	const value = (data as Record<string, unknown>)[prop]
	if (value === undefined) {
		return undefined
	}
	if (!Array.isArray(value)) {
		throw new Error(`Invalid ${prop}`)
	}
	return parseItem ? value.map((x) => parseItem(x)) : value
}

function parseArrayProp<T>(data: unknown, prop: string, parseItem?: (item: unknown) => T): T[] {
	const value = (data as Record<string, unknown>)[prop]
	if (!Array.isArray(value)) {
		throw new Error(`Invalid ${prop}`)
	}
	return parseItem ? value.map((x) => parseItem(x)) : value
}

function parseAccountProp(data: unknown, prop: string): CaipAccount {
	const value = (data as Record<string, unknown>)[prop]
	if (typeof value === "string") {
		const ss = value.split(":")
		if (ss.length === 3) {
			const [namespace, chainId] = ss
			if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
				return value as CaipAccount
			}
		}
	}
	throw new Error(`Invalid ${prop}`)
}

function parseChainProp(data: unknown, prop: string): CaipChain {
	const value = (data as Record<string, unknown>)[prop]
	if (typeof value === "string") {
		const ss = value.split(":")
		if (ss.length === 2) {
			const [namespace, chainId] = ss
			if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
				return value as CaipChain
			}
		}
	}
	throw new Error(`Invalid ${prop}`)
}

function parseChain(data: unknown): CaipChain {
	if (typeof data === "string") {
		const ss = data.split(":")
		if (ss.length === 2) {
			const [namespace, chainId] = ss
			if (namespace === "aztec" && Number.isSafeInteger(+chainId)) {
				return data as CaipChain
			}
		}
	}
	throw new Error("Invalid chain")
}

function parseOptionalBooleanProp(data: unknown, prop: string): boolean | undefined {
	const value = (data as Record<string, unknown>)[prop]
	if (value !== undefined && typeof value !== "boolean") {
		throw new Error(`Invalid ${prop}`)
	}
	return value as boolean | undefined
}

function _parseBooleanProp(data: unknown, prop: string): boolean {
	const value = (data as Record<string, unknown>)[prop]
	if (typeof value !== "boolean") {
		throw new Error(`Invalid ${prop}`)
	}
	return value
}

function parseOptionalStringProp(data: unknown, prop: string): string | undefined {
	const value = (data as Record<string, unknown>)[prop]
	if (value !== undefined && typeof value !== "string") {
		throw new Error(`Invalid ${prop}`)
	}
	return value as string | undefined
}

function parseStringProp(data: unknown, prop: string): string {
	const value = (data as Record<string, unknown>)[prop]
	if (typeof value !== "string") {
		throw new Error(`Invalid ${prop}`)
	}
	return value
}

function _parseNumberProp(data: unknown, prop: string): number {
	const value = (data as Record<string, unknown>)[prop]
	if (typeof value !== "number") {
		throw new Error(`Invalid ${prop}`)
	}
	return value
}

export function parseString(data: unknown, errorMessage?: string): string {
	if (typeof data !== "string") {
		throw new Error(errorMessage ?? "Invalid string value")
	}
	return data
}

function parseRequiredProp<T>(data: unknown, prop: string): T {
	const value = (data as Record<string, unknown>)[prop]
	if (value === undefined) {
		throw new Error(`Invalid ${prop}`)
	}
	return value as T
}

function parseOptionalProp<T>(data: unknown, prop: string): T | undefined {
	const value = (data as Record<string, unknown>)[prop]
	if (value === undefined) {
		return undefined
	}
	return value as T
}
