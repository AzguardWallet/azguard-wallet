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
    LogOrigin,
    LoggerServiceMethod,
} from "./client";
import { LoggerServiceEvent, LoggerServiceEventMessage } from "./client/events";

export class LoggerService extends Service {

    public constructor(
        private readonly logs: ILogs,
        emit: (event: EventMessage) => void
    ) {        
        super(LOGGER_SERVICE_NAME, logs, emit);
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
                    this.addLogWithMeta(
                        _request.level,
                        _request.args,
                        _request.source,
                        _request.origin,
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

    public addLogWithMeta(level: LogLevel, args?: any[], source?: string, origin?: LogOrigin): void {
        const log = this.logs.add(level, args, source, origin);

        if (log) {
            this.emit(new LoggerServiceEventMessage(LoggerServiceEvent.LogAdded, log));
        }
    }

    public addLog(level: LogLevel, ...args: any[]): void {
        const log = this.logs.add(level, args);

        if (log) {
            this.emit(new LoggerServiceEventMessage(LoggerServiceEvent.LogAdded, log));
        }
    }

    public clearLogs(): void {
        this.logs.clear();
    }
}
