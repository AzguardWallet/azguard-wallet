import type { OperationKind } from "@/wallet/services/execution/spec"
import type { TxOrigin, TransferType } from "@/wallet/services/transaction/spec"

export const TASK_SERVICE_NAME = "task"

export const TASK_RETENTION_PERIOD_MS = 60 * 60 * 1000 // 60 minutes in milliseconds

export enum TaskStatus {
	Pending,
	Processing,
	Completed,
	Cancelled,
	Failed,
}

export type Task = {
	id: string
	content: ITaskContent
	status: TaskStatus
	createdAt: number
	startedAt?: number
	subtasks: Task[]
	origin?: TxOrigin
	parentId?: string
	finishedAt?: number
	result?: ITaskResult
	error?: string
}

export enum ContentKind {
	Step,
	BalanceUpdate,
	TokenMint,
	ExecuteOperation,
	Transfer,
	RevokeAuthwits,
}

export interface ITaskContent {
	kind: ContentKind
	label: string
	estimatedTime?: number
}

export class StepContent implements ITaskContent {
	public readonly kind = ContentKind.Step
	constructor(
		public readonly label: string,
		public readonly estimatedTime?: number,
	) {}
}

export class BalanceUpdateContent implements ITaskContent {
	public readonly kind = ContentKind.BalanceUpdate
	public readonly label = "Refresh token balance"
	constructor(
		public readonly tbId: number,
		public readonly account: string,
		public readonly estimatedTime?: number,
	) {}
}

export class TokenMintContent implements ITaskContent {
	public readonly kind = ContentKind.TokenMint
	public readonly label = "Mint token"
	constructor(
		public readonly name: string,
		public readonly symbol: string,
		public readonly decimals: number,
		public readonly amount: string,
		public readonly account: string,
		public readonly estimatedTime?: number,
	) {}
}

export class ExecuteOperationContent implements ITaskContent {
	public readonly kind = ContentKind.ExecuteOperation
	public readonly label = "Execute operation"
	constructor(
		public readonly operationKind: OperationKind,
		public readonly primaryMethod?: string,
	) {}
}

export class TransferContent implements ITaskContent {
	public readonly kind = ContentKind.Transfer
	public readonly label = "Transfer"
	constructor(
		public readonly tokenId: number,
		public readonly transferType: TransferType,
		public readonly senderAddress: string,
		public readonly recipientAddress: string,
		public readonly amount: bigint,
	) {}
}

export class RevokeAuthwitsContent implements ITaskContent {
	public readonly kind = ContentKind.RevokeAuthwits
	public readonly label = "Revoke public authwits"
	constructor(
		public readonly authwitIds: number[],
		public readonly estimatedTime?: number,
	) {}
}

export enum ResultKind {
	Empty,
}

export interface ITaskResult {
	kind: ResultKind
}

export class EmptyResult implements ITaskResult {
	public readonly kind = ResultKind.Empty
}

export type Methods = {
	/**
	 * Gets a task by its ID.
	 * @param id The ID of the task to retrieve.
	 */
	getTask(id: string): Task
	/**
	 * Gets all tasks.
	 */
	getTasks(): Task[]
}

export type Events = {
	/** Emitted when a new task is created */
	onTaskCreated: Task
	/** Emitted when an existing task is updated */
	onTaskUpdated: Task
	/** Emitted when an existing task is deleted */
	onTaskDeleted: Task
}
