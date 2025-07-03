import { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { Task } from "./models";
import { TaskServiceEvent, TaskServiceEventMessage } from "./events";
import { GetAllTasksRequest, GetTaskRequest } from "./methods";

export const TASK_SERVICE_NAME = "task";

export * from "./events";
export * from "./methods";
export * from "./models";

/**
 * Client for interaction with the TaskService via messaging API
 */
export class TaskServiceClient extends ServiceClient {
    /**
     * Creates TaskServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onTaskCreated Callback, called when a new task is created.
     * @param onTaskUpdated Callback, called when a task is updated.
     * @param onTaskDeleted Callback, called when a task is deleted.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onTaskCreated?: (task: Task) => void,
        private readonly onTaskUpdated?: (task: Task) => void,
        private readonly onTaskDeleted?: (task: Task) => void,
    ) {
        super(TASK_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case TaskServiceEvent.TaskCreated: {
                if (this.onTaskCreated) {
                    const { task } = message as TaskServiceEventMessage;
                    try {
                        this.onTaskCreated(task);
                    } catch {}
                }
                break;
            }
            case TaskServiceEvent.TaskUpdated: {
                if (this.onTaskUpdated) {
                    const { task } = message as TaskServiceEventMessage;
                    try {
                        this.onTaskUpdated(task);
                    } catch {}
                }
                break;
            }
            case TaskServiceEvent.TaskDeleted: {
                if (this.onTaskDeleted) {
                    const { task } = message as TaskServiceEventMessage;
                    try {
                        this.onTaskDeleted(task);
                    } catch {}
                }
                break;
            }
            default: {
                console.error(`Unexpected event type ${message.event}.`);
                break;
            }
        }
    }

    /**
     * Gets a task by its ID.
     * @param taskId The ID of the task to retrieve.
     * @returns Promise resolving to the requested task.
     */
    public getTask(taskId: string): Promise<Task> {
        return this.request(new GetTaskRequest(taskId));
    }

    /**
     * Gets all tasks.
     * @returns Promise resolving to a tree of all tasks.
     */
    public getAllTasks(): Promise<Task[]> {
        return this.request(new GetAllTasksRequest());
    }
}
