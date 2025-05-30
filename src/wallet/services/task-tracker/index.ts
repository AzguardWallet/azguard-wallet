import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { getRandomHex } from "@/wallet/utils";
import {
    TASK_TRACKER_SERVICE_NAME,
    Task,
    TaskTrackerServiceMethod,
    GetAllTasksRequest,
    GetAllTasksResponse,
    GetTaskRequest,
    GetTaskResponse,
    ITask,
    TaskTrackerServiceEvent,
    TaskTrackerServiceEventMessage,
    TaskStatus,
} from "./client";

export const TASK_RETENTION_PERIOD_MS = 60 * 60 * 1000; // 60 minutes in milliseconds

export class TaskTrackerService extends Service {
    private readonly tasks: Map<string, ITask> = new Map();

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

    /**
     * Creates a task of any level.
     * @param task - Task to create
     * @param parentId - Optional parent task ID
     * @returns Created ITask instance
     */
    public createTask<TContent, TResult>(task: Task<TContent, TResult>, parentId?: string): ITask {
        let taskId: string;
        do {
            taskId = getRandomHex(8);
        } while (this.tasks.has(taskId));

        const newTask: ITask = {
            id: taskId,
            kind: task.kind,
            content: task.content,
            source: task.source,
            createdAt: task.createdAt,
            parentId,
            finishedAt: task.finishedAt,
            result: task.result,
            error: task.error,
            status: task.status,
            subtasks: [],
        };

        if (parentId) {
            const parent = this.tasks.get(parentId);
            if (!parent) {
                throw new Error(`Parent task ${parentId} does not exist`);
            }
            if (parent.finishedAt) {
                throw new Error(`Cannot add task to finished parent ${parentId}`);
            }
            parent.subtasks.push(newTask);
            this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, parent));
        }

        this.tasks.set(newTask.id, newTask);
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskCreated, newTask));
        return newTask;
    }

    /**
     * Completes task and follows active child chain.
     * - Completes specified task with result/error
     * - Automatically completes active children in chain
     * - Propagates errors down the chain
     * @param taskId - Task ID to complete
     * @param result - Optional completion result
     * @param error - Optional error message
     */
    public completeTask(taskId: string, result?: unknown, error?: string): void {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} does not exist`);
        }

        if (result !== undefined && error !== undefined) {
            throw new Error("Cannot complete task with both result and error");
        }

        const unfinishedSubtasks = task.subtasks.filter(t => !t.finishedAt);
        if (unfinishedSubtasks.length > 0) {
            const unfinishedIds = unfinishedSubtasks.map(t => t.id).join(", ");
            throw new Error(`Cannot complete task ${taskId} with unfinished subtasks: ${unfinishedIds}`);
        }

        task.finishedAt = Date.now();
        if (error) {
            task.error = error;
            task.status = TaskStatus.Failed;
        } else {
            task.result = result;
            task.status = TaskStatus.Completed;
        }
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));
    }

    public startTask(taskId: string): void {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} does not exist`);
        }
        if (task.status !== TaskStatus.Pending) {
            throw new Error(`Cannot start task ${taskId} that is not pending`);
        }
        task.status = TaskStatus.Processing;
        this.emit(new TaskTrackerServiceEventMessage(TaskTrackerServiceEvent.TaskUpdated, task));
    }

    public getTask(taskId: string): ITask {
        // NOTE: there is a chance of requested task being deleted during the task request
        this.cleanupStaleTasks();
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error("Invalid task id");
        }
        return task;
    }

    public getTasks(): ITask[] {
        this.cleanupStaleTasks();
        return this.getRootTasks();
    }

    private getRootTasks(): ITask[] {
        return Array.from(this.tasks.values()).filter(t => !t.parentId);
    }

    private cleanupStaleTasks(): void {
        const now = Date.now();
        const isStale = (task: ITask) => task.finishedAt && now - task.finishedAt > TASK_RETENTION_PERIOD_MS;
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
