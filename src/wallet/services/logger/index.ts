import { Service } from "@/wallet/base/port-service/service";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import {
    type AddLogRequest,
    AddLogResponse,
    type GetLogsRequest,
    GetLogsResponse,
    type ILogs,
    LOGGER_SERVICE_NAME,
    type LogEntity,
    LogLevel,
    type LogOrigin,
    LoggerServiceMethod
} from "./client";
import { LoggerServiceEvent, LoggerServiceEventMessage } from "./client/events";
import { ConsoleSnifferServiceClient } from "@/wallet/services/console-sniffer/client";

export class LoggerService extends Service {
    private readonly consoleSnifferService: ConsoleSnifferServiceClient;

    public constructor(
        private readonly logs: ILogs,
        emit: (event: EventMessage) => void
    ) {        
        super(LOGGER_SERVICE_NAME, logs, emit);
        this.consoleSnifferService = new ConsoleSnifferServiceClient(undefined, this.onSnifferLogAdded)
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case LoggerServiceMethod.GetLogs: {
                const _request = request as GetLogsRequest;
                try {
                    const result = await this.getLogs(_request.count);
                    return new GetLogsResponse(_request, result);
                } catch (error: any) {
                    return new GetLogsResponse(_request, undefined, error.message);
                }
            }
            case LoggerServiceMethod.AddLog: {
                const _request = request as AddLogRequest;
                try {
                    this.addLog(
                        _request.level,
                        _request.args,
                        _request.message,
                        _request.source,
                    );
                    return new AddLogResponse(_request);
                } catch (error: any) {
                    return new AddLogResponse(_request, error.message);
                }
            }
            default: {
                this.addLog(LogLevel.Error, `Invalid request method ${request.method}`);
                return undefined;
            }                
        }
    }

    private async getLogs(count?: number): Promise<LogEntity[]> {
        return this.logs.get(count);
    }

    public addLog(level: LogLevel, args: any, message?: string, source?: string, origin?: LogOrigin): void {
        const log = this.logs.add(
            level,
            args,
            message,
            source,
            origin,
        );

        if (log) {
            this.emit(new LoggerServiceEventMessage(LoggerServiceEvent.LogAdded, log));
        }
    }

    private onSnifferLogAdded = (logEntity: LogEntity) => {
        this.addLog(logEntity.level, logEntity.args, undefined, logEntity.source, logEntity.origin);
    }
}
