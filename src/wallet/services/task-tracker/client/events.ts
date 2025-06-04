import { EventMessage } from "@/wallet/base/port-service/messages";
import { Task } from "./models";
import { TASK_TRACKER_SERVICE_NAME } from ".";

export enum TaskTrackerServiceEvent {
    TaskCreated,
    TaskUpdated,
    TaskDeleted,
}

export class TaskTrackerServiceEventMessage extends EventMessage {
    constructor(
        event: TaskTrackerServiceEvent,
        public readonly task: Task,
    ) {
        super(TASK_TRACKER_SERVICE_NAME, event);
    }
}
