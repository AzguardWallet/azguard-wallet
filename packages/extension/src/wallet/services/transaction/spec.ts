import type { NuloFeePaymentMethod } from "../account/contracts"

export const TRANSACTION_SERVICE_NAME = "transaction"

export enum OriginType {
	UI,
	DAPP,
	Synced,
}

export type TxOrigin = {
	/** Origin type. */
	type: OriginType
	/** Origin name. */
	name?: string
}

/** Origin for local transactions (UI/DApp). */
export type LocalTxOrigin = {
	type: OriginType.UI | OriginType.DAPP
	name?: string
}

/** Block inclusion/finalization status. */
export enum TxStatus {
	Pending,
	Dropped,
	Proposed,
	Checkpointed,
	Proven,
	Finalized,
}

/** Execution result — only meaningful when tx is in a block. */
export enum TxExecutionResult {
	Success,
	AppLogicReverted,
	TeardownReverted,
	BothReverted,
}

/** Full transaction call from UI/DApp interaction. */
export type TxCall = {
	/** Contract address. */
	contract: string
	/** Function name. */
	method: string
	/** Arguments. */
	args: unknown[]
	/** Additional information telling whether the call produces token transfers. */
	transfers?: TxTransfer[]
}

/**
 * Transaction call reconstructed from on-chain events.
 * Contains only args hash (full args are not recoverable).
 */
export type SyncedTxCall = {
	/** Contract address. */
	contract: string
	/** Function name (may not be resolved if contract artifact unknown). */
	method?: string
	/** Function selector. */
	selector: string
	/** Arguments hash (args are not recoverable from private events). */
	argsHash: string
	/** Call index within the batch transaction (0-3). Used together with chunkNonce for deduplication. */
	callIndex: number
	/** Chunk nonce, only set when call is part of a chunked batch (differs from Tx.nonce). */
	chunkNonce?: string
	/** True if this is an internal batch call (execute call to account contract itself). */
	isBatch?: boolean
}

export enum TransferType {
	Private,
	PrivateToPublic,
	Public,
	PublicToPrivate,
}

export type TransferToken = {
	name: string
	symbol: string
	decimals: number
}

export type TxTransfer = {
	/** Token info. */
	token: TransferToken
	/** Transfer type. */
	type: TransferType
	/** Sender. */
	from: string
	/** Recipient. */
	to: string
	/** Amount. */
	amount: string
}

export type TxBlock = {
	/** Block hash. */
	hash: string
	/** Block number/level/height. */
	number: number
}

export type TxIndexerCursor = {
	/** Account address (used as EntityStorage key). */
	account: string
	/** Chain ID. */
	chainId: number
	/** Next block to sync from (inclusive). Starts at 1. */
	head: number
	/** Timestamp (ms) of last successful sync completion. null if never completed. */
	updatedAt: number | null
}

/** Gas breakdown captured at submission time from finalized GasSettings. */
export type TxGasDetails = {
	/** L2 gas limit (app logic). */
	l2GasLimit: number
	/** DA gas limit (app logic). */
	daGasLimit: number
	/** L2 gas limit (teardown/fee payment). */
	teardownL2GasLimit: number
	/** DA gas limit (teardown/fee payment). */
	teardownDaGasLimit: number
	/** Fee per L2 gas unit (raw bigint as string). */
	feePerL2Gas: string
	/** Fee per DA gas unit (raw bigint as string). */
	feePerDaGas: string
}

/** Common fields for all transaction types. */
type TxBase = {
	/** Chain id. */
	chainId: number
	/** Sender address. */
	account: string
	/** Nonce. */
	nonce: string
	/** Fee payment method. */
	feePaymentMethod: NuloFeePaymentMethod
	/** Transaction hash. */
	hash: string
	/** Creation time. */
	createdAt: number
	/** Update time. */
	updatedAt: number
	/** Transaction status. */
	status: TxStatus
	/** Execution result (success/revert info). */
	executionResult?: TxExecutionResult
	/** Block in which the transaction is included. */
	block?: TxBlock
	/** Fee paid (set from receipt after confirmation). */
	fee?: string
	/** Estimated fee from gas settings (set at submission time). */
	estimatedFee?: string
	/** Gas breakdown from finalized gas settings (set at submission time). */
	gasDetails?: TxGasDetails
	/** Error message, if some. */
	error?: string
}

/** Transaction from UI or DApp interaction (has full call details). */
export type LocalTx = TxBase & {
	origin: LocalTxOrigin
	calls: TxCall[]
}

/** Transaction reconstructed from on-chain events. */
export type SyncedTx = TxBase & {
	origin: { type: OriginType.Synced; name?: string }
	calls: SyncedTxCall[]
}

/** Union of all transaction types. */
export type Tx = LocalTx | SyncedTx

/** Type guard: check if transaction is from local origin (UI/DApp). */
export function isLocalTx(tx: Tx): tx is LocalTx {
	return tx.origin.type === OriginType.UI || tx.origin.type === OriginType.DAPP
}

/** Type guard: check if transaction is synced from chain. */
export function isSyncedTx(tx: Tx): tx is SyncedTx {
	return tx.origin.type === OriginType.Synced
}

export type Methods = {
	/**
	 * Returns a list of transactions for a given account.
	 * @param account Account address.
	 */
	getTransactions(account: string): Tx[]

	/**
	 * Returns a transaction with the specified hash.
	 * @param hash Transaction hash.
	 */
	getTransaction(hash: string): Tx

	/**
	 * Synchronizes transaction history for a persistent account.
	 * Creates a Task and runs sync asynchronously.
	 * @param chainId Chain ID of the network.
	 * @param address Account address to sync.
	 */
	syncTransactionHistory(chainId: number, address: string): void

	/** Returns the sync cursor for a persistent account, or null if none exists. */
	getTxSyncCursor(address: string): TxIndexerCursor | null
}

export type Events = {
	onTransactionAdded: Tx
	onTransactionUpdated: Tx
	onTransactionDeleted: Tx
}
