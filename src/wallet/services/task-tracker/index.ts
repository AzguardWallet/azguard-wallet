import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { getRandomHex } from "@/wallet/utils";
import {
    TASK_TRACKER_SERVICE_NAME,
    TaskTrackerServiceMethod,
    GetAllTasksRequest,
    GetAllTasksResponse,
    GetTaskRequest,
    GetTaskResponse,
    Task,
    TaskTrackerServiceEvent,
    TaskTrackerServiceEventMessage,
    TaskStatus,
    ITaskContent,
    EmptyResult,
    ITaskResult,
} from "./client";

export const TASK_RETENTION_PERIOD_MS = 60 * 60 * 1000; // 60 minutes in milliseconds

export class TaskTrackerService extends Service {
    private readonly tasks: Map<string, Task> = new Map();

    constructor(emit: (event: EventMessage) => void) {
        super(TASK_TRACKER_SERVICE_NAME, emit);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case TaskTrackerServiceMethod.GetAllTasks: {
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
            case TaskTrackerServiceMethod.GetTask: {
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
        source?: string,
        status: TaskStatus = TaskStatus.Pending,
    ): string {
        let taskId: string;
        do {
            taskId = getRandomHex(8);
        } while (this.tasks.has(taskId));

        const newTask: Task = {
            id: taskId,
            content,
            status,
            createdAt: Date.now(),
            startedAt: undefined,
            subtasks: [],
            source,
            parent: undefined,
            finishedAt: undefined,
            result: undefined,
            error: undefined,
        };

        if (status !== TaskStatus.Pending) {
            newTask.startedAt = Date.now();
        }

        if (parentId) {
            const parent = this.getTaskById(parentId);
            if (parent.finishedAt) {
                throw new Error(`Cannot add task to finished parent ${parentId}`);
            }
            newTask.parent = parent;
            parent.subtasks.push(newTask);
            this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, parent));
        }

        this.tasks.set(newTask.id, newTask);
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskCreated, newTask));
        return newTask.id;
    }

    /**
     * Creates a new pending task of any level.
     * @param content - Task content
     * @param parentId - Optional parent task ID
     * @param source - Optional source of the task
     * @returns Created task ID
     */
    public createNewTask(content: ITaskContent, parentId?: string, source?: string): string {
        return this.createTask(content, parentId, source, TaskStatus.Pending);
    }

    /**
     * Creates a new processing task of any level.
     * @param content - Task content
     * @param parentId - Optional parent task ID
     * @param source - Optional source of the task
     * @returns Created task ID
     */
    public startNewTask(content: ITaskContent, parentId?: string, source?: string): string {
        return this.createTask(content, parentId, source, TaskStatus.Processing);
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

    /**
     * Completes task with result.
     * @param taskId - Task ID to complete
     * @param result - Completion result (default: EmptyResult)
     */
    public completeTask(taskId: string, result: ITaskResult = new EmptyResult()): void {
        const task = this.getTaskById(taskId);
        this.validateTaskBeforeFinish(task);

        task.finishedAt = Date.now();
        task.result = result;
        task.status = TaskStatus.Completed;
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));
    }

    /**
     * Fails task with error.
     * @param taskId - Task ID to fail
     * @param error - Error message
     */
    public failTask(taskId: string, error: string = "Unknown error"): void {
        const task = this.getTaskById(taskId);
        this.validateTaskBeforeFinish(task);

        task.error = error;
        task.finishedAt = Date.now();
        task.status = TaskStatus.Failed;
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));
    }

    public startTask(taskId: string): void {
        const task = this.getTaskById(taskId);
        if (task.status !== TaskStatus.Pending) {
            throw new Error(`Cannot start task ${taskId} that is not pending`);
        }
        task.status = TaskStatus.Processing;
        task.startedAt = Date.now();
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));
    }

    private getTaskById(taskId: string): Task {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Invalid task id: ${taskId}`);
        }
        return task;
    }

    public getTask(taskId: string): Task {
        // NOTE: there is a chance of requested task being deleted during the task request
        this.cleanupStaleTasks();
        return this.getTaskById(taskId);
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
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskDeleted, task));
    }
}
