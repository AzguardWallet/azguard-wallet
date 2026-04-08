import type { ServiceCollection, ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import type { ILogger } from "@/wallet/logger"
import { ProfileService, type ProfileInfo } from "@/wallet/services/profile/service"
import type { TxOrigin } from "@/wallet/services/transaction/service"
import { getRandomHex } from "@/wallet/utils"
import { EventHandler } from "@/wallet/utils/event-handler"
import {
	TASK_SERVICE_NAME,
	type Task,
	TaskStatus,
	type ITaskContent,
	EmptyResult,
	type ITaskResult,
	type Methods,
	type Events,
	TASK_RETENTION_PERIOD_MS,
} from "./spec"
import { WrappedTask } from "./wrapped-task"

export * from "./spec"
export * from "./wrapped-task"

export class TaskService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
	public static name = TASK_SERVICE_NAME

	public readonly onTaskCreated = new EventHandler<Task>()
	public readonly onTaskUpdated = new EventHandler<Task>()
	public readonly onTaskDeleted = new EventHandler<Task>()

	private readonly tasks: Map<string, Task> = new Map()
	private profile?: string = undefined

	private profileService: ProfileService = null!

	public constructor(logger: ILogger) {
		super(TASK_SERVICE_NAME, logger)
	}

	protected async init(services: ServiceCollection) {
		this.profileService = services.get(ProfileService.name)
		this.profileService.onActiveProfileChanged.add(this.onActiveProfileChanged)
	}

	private createTask(content: ITaskContent, parentId?: string, origin?: TxOrigin, status: TaskStatus = TaskStatus.Pending): WrappedTask {
		let taskId: string
		do {
			taskId = getRandomHex(8)
		} while (this.tasks.has(taskId))

		const parent = parentId ? this.getTaskById(parentId) : undefined
		if (parent?.finishedAt) {
			throw new Error(`Cannot add task to finished parent ${parentId}`)
		}

		const newTask: Task = {
			id: taskId,
			content,
			status,
			createdAt: Date.now(),
			startedAt: undefined,
			subtasks: [],
			origin,
			parentId: parent?.id,
			finishedAt: undefined,
			result: undefined,
			error: undefined,
		}

		if (status !== TaskStatus.Pending) {
			newTask.startedAt = Date.now()
		}

		this.tasks.set(newTask.id, newTask)
		this.emit("onTaskCreated", newTask)

		if (parent) {
			parent.subtasks.push(newTask)
			this.emit("onTaskUpdated", parent)
		}
		return new WrappedTask(newTask.id, this, origin)
	}

	/**
	 * Creates a new pending task of any level.
	 * @param content - Task content
	 * @param parentId - Optional parent task ID
	 * @param origin - Optional origin of the task
	 * @returns Created task wrapper
	 */
	public createNewTask(content: ITaskContent, parentId?: string, origin?: TxOrigin): WrappedTask {
		return this.createTask(content, parentId, origin, TaskStatus.Pending)
	}

	/**
	 * Creates a new processing task of any level.
	 * @param content - Task content
	 * @param parentId - Optional parent task ID
	 * @param origin - Optional origin of the task
	 * @returns Created task wrapper
	 */
	public startNewTask(content: ITaskContent, parentId?: string, origin?: TxOrigin): WrappedTask {
		return this.createTask(content, parentId, origin, TaskStatus.Processing)
	}

	private validateTaskBeforeFinish(task: Task): void {
		if (task.finishedAt) {
			throw new Error(`Cannot finish already finished task ${task.id}`)
		}
		const unfinishedSubtasks = task.subtasks.filter((t) => !t.finishedAt)
		if (unfinishedSubtasks.length > 0) {
			const unfinishedIds = unfinishedSubtasks.map((t) => t.id).join(", ")
			throw new Error(`Cannot finish task ${task.id} with unfinished subtasks: ${unfinishedIds}`)
		}
	}

	private validateNotPending(task: Task): void {
		if (task.status === TaskStatus.Pending) {
			throw new Error(`Cannot finish pending task ${task.id} since it is not started`)
		}
	}

	/**
	 * Completes task with result.
	 * @param taskId - Task ID to complete
	 * @param result - Completion result (default: EmptyResult)
	 */
	public completeTask(taskId: string, result: ITaskResult = new EmptyResult()): void {
		const task = this.getTaskById(taskId)
		this.validateNotPending(task)
		this.validateTaskBeforeFinish(task)

		task.finishedAt = Date.now()
		task.result = result
		task.status = TaskStatus.Completed
		this.emit("onTaskUpdated", task)
	}

	/**
	 * Fails task with error.
	 * @param taskId - Task ID to fail
	 * @param error - Error message
	 */
	public failTask(taskId: string, error = "Unknown error"): void {
		const task = this.getTaskById(taskId)
		this.validateNotPending(task)
		this.validateTaskBeforeFinish(task)

		task.error = error
		task.finishedAt = Date.now()
		task.status = TaskStatus.Failed
		this.emit("onTaskUpdated", task)
	}

	/**
	 * Cancels task.
	 * @param taskId - Task ID to cancel
	 */
	public cancelTask(taskId: string): void {
		const task = this.getTaskById(taskId)
		this.validateTaskBeforeFinish(task)

		task.finishedAt = Date.now()
		task.status = TaskStatus.Cancelled
		this.emit("onTaskUpdated", task)
	}

	public startTask(taskId: string): void {
		const task = this.getTaskById(taskId)
		if (task.status !== TaskStatus.Pending) {
			throw new Error(`Cannot start task ${taskId} that is not pending`)
		}
		task.status = TaskStatus.Processing
		task.startedAt = Date.now()
		this.emit("onTaskUpdated", task)
	}

	private getTaskById(taskId: string): Task {
		const task = this.tasks.get(taskId)
		if (!task) {
			throw new Error(`Invalid task id: ${taskId}`)
		}
		return task
	}

	public async getTask(taskId: string): Promise<Task> {
		const task = this.getTaskById(taskId)
		this.cleanupStaleTasks()
		if (!this.tasks.has(taskId)) {
			throw new Error(`Task ${taskId} has been expired`)
		}
		return task
	}

	public getTaskSync(taskId: string): Task {
		const task = this.getTaskById(taskId)
		this.cleanupStaleTasks()
		if (!this.tasks.has(taskId)) {
			throw new Error(`Task ${taskId} has been expired`)
		}
		return task
	}

	public async getTasks(): Promise<Task[]> {
		this.cleanupStaleTasks()
		return this.getRootTasks()
	}

	public getTasksSync(): Task[] {
		this.cleanupStaleTasks()
		return this.getRootTasks()
	}

	private getRootTasks(): Task[] {
		return Array.from(this.tasks.values()).filter((t) => !t.parentId)
	}

	private cleanupStaleTasks(): void {
		const now = Date.now()
		const isStale = (task: Task) => task.finishedAt && now - task.finishedAt > TASK_RETENTION_PERIOD_MS
		const staleRoots = this.getRootTasks().filter((task) => isStale(task))

		for (const root of staleRoots) {
			this.deleteTaskTree(root.id)
		}
	}

	private deleteTaskTree(taskId: string): void {
		const task = this.tasks.get(taskId)
		if (!task) return

		task.subtasks.forEach((child) => this.deleteTaskTree(child.id))
		this.tasks.delete(taskId)
		this.emit("onTaskDeleted", task)
	}

	private readonly onActiveProfileChanged = async (profile?: ProfileInfo) => {
		if (profile) {
			if (this.profile && this.profile !== profile.id) {
				this.tasks.clear()
				this.logDebug(`Tasks cleared for profile #${profile.id}`)
			}
			this.profile = profile.id
		}
	}
}
