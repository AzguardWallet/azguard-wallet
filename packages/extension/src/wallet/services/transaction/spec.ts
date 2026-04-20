import type { NuloFeePaymentMethod } from "../account/contracts"

export const TRANSACTION_SERVICE_NAME = "transaction"

export enum OriginType {
	UI,
	DAPP,
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

/** Transaction from UI or DApp interaction (has full call details). */
export type Tx = {
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
	origin: LocalTxOrigin
	calls: TxCall[]
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
}

export type Events = {
	onTransactionAdded: Tx
	onTransactionUpdated: Tx
	onTransactionDeleted: Tx
}
