import { EventMessage } from "@/wallet/base/port-service/messages";
import type { Task } from "./models";
import { TASK_SERVICE_NAME } from ".";

export enum TaskServiceEvent {
    TaskCreated,
    TaskUpdated,
    TaskDeleted,
}

export class TaskServiceEventMessage extends EventMessage {
    constructor(
        event: TaskServiceEvent,
        public readonly task: Task,
    ) {
        super(TASK_SERVICE_NAME, event);
    }
}
