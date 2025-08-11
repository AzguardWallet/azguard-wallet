import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { TASK_SERVICE_NAME, Task } from ".";

export enum TaskServiceMethod {
    GetAllTasks,
    GetTask,
}

export class GetAllTasksRequest extends RequestMessage {
    constructor() {
        super(TASK_SERVICE_NAME, TaskServiceMethod.GetAllTasks);
    }
}

export class GetAllTasksResponse extends ResponseMessage {
    constructor(request: GetAllTasksRequest, result?: Task[], error?: string) {
        super(TASK_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetTaskRequest extends RequestMessage {
    constructor(public readonly taskId: string) {
        super(TASK_SERVICE_NAME, TaskServiceMethod.GetTask);
    }
}

export class GetTaskResponse extends ResponseMessage {
    constructor(request: GetTaskRequest, result?: Task, error?: string) {
        super(TASK_SERVICE_NAME, request.requestId, result, error);
    }
}
