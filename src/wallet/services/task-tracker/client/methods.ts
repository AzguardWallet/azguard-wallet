import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { TASK_TRACKER_SERVICE_NAME, ITask } from ".";

export enum TaskTrackerServiceMethod {
    GetAllTasks,
    GetTask,
}

export class GetAllTasksRequest extends RequestMessage {
    constructor() {
        super(TASK_TRACKER_SERVICE_NAME, TaskTrackerServiceMethod.GetAllTasks);
    }
}

export class GetAllTasksResponse extends ResponseMessage {
    constructor(request: GetAllTasksRequest, result?: ITask[], error?: string) {
        super(TASK_TRACKER_SERVICE_NAME, request.requestId, result, error);
    }
}

export class GetTaskRequest extends RequestMessage {
    constructor(public readonly taskId: string) {
        super(TASK_TRACKER_SERVICE_NAME, TaskTrackerServiceMethod.GetTask);
    }
}

export class GetTaskResponse extends ResponseMessage {
    constructor(request: GetTaskRequest, result?: ITask, error?: string) {
        super(TASK_TRACKER_SERVICE_NAME, request.requestId, result, error);
    }
}
