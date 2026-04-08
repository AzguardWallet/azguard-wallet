import { TxOrigin } from "@/wallet/services/transaction/spec"
import { getErrorMessage } from "@/wallet/utils/errors"
import { TaskService, ITaskContent, ITaskResult, EmptyResult, TaskStatus, Task } from "./service"

export class WrappedTask {
	constructor(
		public readonly id: string,
		private readonly taskService: TaskService,
		public readonly origin?: TxOrigin,
	) {}

	public createSubtask(content: ITaskContent): WrappedTask {
		return this.taskService.createNewTask(content, this.id, this.origin)
	}

	public startSubtask(content: ITaskContent): WrappedTask {
		return this.taskService.startNewTask(content, this.id, this.origin)
	}

	public start(): void {
		this.taskService.startTask(this.id)
	}

	public complete(result: ITaskResult = new EmptyResult()): void {
		this.taskService.completeTask(this.id, result)
	}

	public fail(error: unknown): void {
		this.taskService.failTask(this.id, getErrorMessage(error))
	}

	public cancel(): void {
		this.taskService.cancelTask(this.id)
	}

	public get task(): Task {
		return this.taskService.getTaskSync(this.id)
	}

	public get status(): TaskStatus {
		return this.task.status
	}

	public get isFinished(): boolean {
		const status = this.status
		return status === TaskStatus.Completed || status === TaskStatus.Failed || status === TaskStatus.Cancelled
	}
}
