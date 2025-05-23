import { EventMessage } from "@/wallet/base/port-service/messages";
import { LOGGER_SERVICE_NAME, LogEntity } from ".";

export enum LoggerServiceEvent {
    LogAdded,
}

export class LoggerServiceEventMessage extends EventMessage {
    constructor(
        event: LoggerServiceEvent,
        public readonly logEntity: LogEntity,
    ) {
        super(LOGGER_SERVICE_NAME, event);
    }
}
