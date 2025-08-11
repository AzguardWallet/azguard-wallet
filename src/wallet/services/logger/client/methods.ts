import { RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { type LogEntity, type LogLevel, LOGGER_SERVICE_NAME, type LogOrigin } from ".";

export enum LoggerServiceMethod {
    AddLog,
    GetLogs,
}

export class GetLogsRequest extends RequestMessage {
    constructor(
        public readonly count?: number,
    ) {
        super(LOGGER_SERVICE_NAME, LoggerServiceMethod.GetLogs);
    }
}

export class GetLogsResponse extends ResponseMessage {
    constructor(
        request: GetLogsRequest,
        result?: LogEntity[],
        error?: string,
    ) {
        super(LOGGER_SERVICE_NAME, request.requestId, result, error);
    }
}

export class AddLogRequest extends RequestMessage {
    constructor(
        public readonly level: LogLevel,
        public readonly message: string,
        public readonly args?: any[],
        public readonly source?: string,
        public readonly origin?: LogOrigin,
    ) {
        super(LOGGER_SERVICE_NAME, LoggerServiceMethod.AddLog);
    }
}

export class AddLogResponse extends ResponseMessage {
    constructor(
        request: AddLogRequest,
        error?: string,
    ) {
        super(LOGGER_SERVICE_NAME, request.requestId, undefined, error);
    }
}
