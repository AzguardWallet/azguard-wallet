import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { type ILogs } from "@/wallet/services/logger/client";
import { getRandomHex } from "@/wallet/utils";
import {
    TASK_SERVICE_NAME,
    TaskServiceMethod,
    GetAllTasksRequest,
    GetAllTasksResponse,
    GetTaskRequest,
    GetTaskResponse,
    Task,
    TaskServiceEvent,
    TaskServiceEventMessage,
    TaskStatus,
    ITaskContent,
    EmptyResult,
    ITaskResult,
} from "./client";
import { WrappedTask } from "./wrapped-task";
import { TxOrigin } from "@/wallet/services/transaction/client";
import { ProfileService } from "@/wallet/services/profile";

export const TASK_RETENTION_PERIOD_MS = 60 * 60 * 1000; // 60 minutes in milliseconds

export class TaskService extends Service {
    private readonly tasks: Map<string, Task> = new Map();
    private profile?: string = undefined

    constructor(
        private readonly profileService: ProfileService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {
        super(TASK_SERVICE_NAME, logger, emit);
        this.profileService.onActiveProfileChanged.push(this.onActiveProfileChanged);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case TaskServiceMethod.GetAllTasks: {
                const _request = request as GetAllTasksRequest;
                try {
                    return new GetAllTasksResponse(_request, this.getTasks());
                } catch (error: unknown) {
                    return new GetAllTasksResponse(
                        _request,
                        undefined,
                        (error as Error)?.message ?? (error as string) ?? "Unknown error",
                    );
                }
            }
            case TaskServiceMethod.GetTask: {
                const _request = request as GetTaskRequest;
                try {
                    return new GetTaskResponse(_request, this.getTask(_request.taskId));
                } catch (error: unknown) {
                    return new GetTaskResponse(
                        _request,
                        undefined,
                        (error as Error)?.message ?? (error as string) ?? "Unknown error",
                    );
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    private createTask(
        content: ITaskContent,
        parentId?: string,
        origin?: TxOrigin,
        status: TaskStatus = TaskStatus.Pending,
    ): WrappedTask {
        let taskId: string;
        do {
            taskId = getRandomHex(8);
        } while (this.tasks.has(taskId));

        const parent = parentId ? this.getTaskById(parentId) : undefined;
        if (parent && parent.finishedAt) {
            throw new Error(`Cannot add task to finished parent ${parentId}`);
        }

        const newTask: Task = {
            id: taskId,
            content,
            status,
            createdAt: Date.now(),
            startedAt: undefined,
            subtasks: [],
            origin,
            parent,
            finishedAt: undefined,
            result: undefined,
            error: undefined,
        };

        if (status !== TaskStatus.Pending) {
            newTask.startedAt = Date.now();
        }

        this.tasks.set(newTask.id, newTask);
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskCreated, newTask));

        if (parent) {
            parent.subtasks.push(newTask);
            this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, parent));
        }
        return new WrappedTask(newTask.id, this, origin);
    }

    /**
     * Creates a new pending task of any level.
     * @param content - Task content
     * @param parentId - Optional parent task ID
     * @param origin - Optional origin of the task
     * @returns Created task wrapper
     */
    public createNewTask(content: ITaskContent, parentId?: string, origin?: TxOrigin): WrappedTask {
        return this.createTask(content, parentId, origin, TaskStatus.Pending);
    }

    /**
     * Creates a new processing task of any level.
     * @param content - Task content
     * @param parentId - Optional parent task ID
     * @param origin - Optional origin of the task
     * @returns Created task wrapper
     */
    public startNewTask(content: ITaskContent, parentId?: string, origin?: TxOrigin): WrappedTask {
        return this.createTask(content, parentId, origin, TaskStatus.Processing);
    }

    private validateTaskBeforeFinish(task: Task): void {
        if (task.finishedAt) {
            throw new Error(`Cannot finish already finished task ${task.id}`);
        }
        const unfinishedSubtasks = task.subtasks.filter(t => !t.finishedAt);
        if (unfinishedSubtasks.length > 0) {
            const unfinishedIds = unfinishedSubtasks.map(t => t.id).join(", ");
            throw new Error(`Cannot finish task ${task.id} with unfinished subtasks: ${unfinishedIds}`);
        }
    }

    private validateNotPending(task: Task): void {
        if (task.status === TaskStatus.Pending) {
            throw new Error(`Cannot finish pending task ${task.id} since it is not started`);
        }
    }

    /**
     * Completes task with result.
     * @param taskId - Task ID to complete
     * @param result - Completion result (default: EmptyResult)
     */
    public completeTask(taskId: string, result: ITaskResult = new EmptyResult()): void {
        const task = this.getTaskById(taskId);
        this.validateNotPending(task);
        this.validateTaskBeforeFinish(task);

        task.finishedAt = Date.now();
        task.result = result;
        task.status = TaskStatus.Completed;
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, task));
    }

    /**
     * Fails task with error.
     * @param taskId - Task ID to fail
     * @param error - Error message
     */
    public failTask(taskId: string, error: string = "Unknown error"): void {
        const task = this.getTaskById(taskId);
        this.validateNotPending(task);
        this.validateTaskBeforeFinish(task);

        task.error = error;
        task.finishedAt = Date.now();
        task.status = TaskStatus.Failed;
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, task));
    }

    /**
     * Cancels task.
     * @param taskId - Task ID to cancel
     */
    public cancelTask(taskId: string): void {
        const task = this.getTaskById(taskId);
        this.validateTaskBeforeFinish(task);

        task.finishedAt = Date.now();
        task.status = TaskStatus.Cancelled;
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, task));
    }

    public startTask(taskId: string): void {
        const task = this.getTaskById(taskId);
        if (task.status !== TaskStatus.Pending) {
            throw new Error(`Cannot start task ${taskId} that is not pending`);
        }
        task.status = TaskStatus.Processing;
        task.startedAt = Date.now();
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskUpdated, task));
    }

    private getTaskById(taskId: string): Task {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Invalid task id: ${taskId}`);
        }
        return task;
    }

    public getTask(taskId: string): Task {
        const task = this.getTaskById(taskId);
        this.cleanupStaleTasks();
        if (!this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} has been expired`);
        }
        return task;
    }

    public getTasks(): Task[] {
        this.cleanupStaleTasks();
        return this.getRootTasks();
    }

    private getRootTasks(): Task[] {
        return Array.from(this.tasks.values()).filter(t => !t.parent);
    }

    private cleanupStaleTasks(): void {
        const now = Date.now();
        const isStale = (task: Task) => task.finishedAt && now - task.finishedAt > TASK_RETENTION_PERIOD_MS;
        const staleRoots = this.getRootTasks().filter(task => isStale(task));

        for (const root of staleRoots) {
            this.deleteTaskTree(root.id);
        }
    }

    private deleteTaskTree(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (!task) return;

        task.subtasks.forEach(child => this.deleteTaskTree(child.id));
        this.tasks.delete(taskId);
        this.emit(new TaskServiceEventMessage(TaskServiceEvent.TaskDeleted, task));
    }

    private readonly onActiveProfileChanged = async (profileId?: string) => {
        if (profileId) {
            if (this.profile && this.profile !== profileId) {
                this.tasks.clear();
                this.logDebug(`Tasks cleared for profile #${profileId}`);
            }
            this.profile = profileId;
        }
    }
}
export { WrappedTask } from "./wrapped-task";
