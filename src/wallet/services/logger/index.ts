import { Service } from "@/wallet/base/port-service/service";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { AddLogRequest, AddLogResponse, GetLogsRequest, GetLogsResponse, LOGGER_SERVICE_NAME, LogEntity, LogLevel, LoggerServiceMethod } from "./client";
import { LoggerServiceEvent, LoggerServiceEventMessage } from "./client/events";
import { ConsoleSnifferServiceClient } from "@/wallet/services/console-sniffer/client";



const LOG_TTL_MS = 1 * 60 * 60 * 1_000; // 1 Hour
const MAX_LOG_ENTRIES = 1_000; // 1_000 entries

export class LoggerService extends Service {
    private storage: LogEntity[] = [];
    private readonly consoleSnifferService: ConsoleSnifferServiceClient;

    public constructor(
        emit: (event: EventMessage) => void
    ) {        
        super(LOGGER_SERVICE_NAME, emit);
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
                        _request.source,
                    );
                    return new AddLogResponse(_request);
                } catch (error: any) {
                    return new AddLogResponse(_request, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }

    private async getLogs(count?: number): Promise<LogEntity[]> {
        return count ? this.storage.slice(-count) : this.storage;
    }

    public addLog(level: LogLevel, args: any, source?: string): void {
        const now = Date.now();
        this.storage = this.storage.filter(e => now - e.ts <= LOG_TTL_MS);

        const rawArgs = Array.isArray(args) ? args : [args];
        const stringArgs = rawArgs.map(a => {
            if (!a) return String(a)
            
            if (typeof a === "object") {
                try {
                    return JSON.stringify(a);
                } catch {
                    return String(a)
                }
            }

            return String(a)
        })

        const newLogEntity = {
            level,
            args: stringArgs,
            ts: now,
            source: source ?? "background",
        };

        this.storage.push(newLogEntity);

        if (this.storage.length > MAX_LOG_ENTRIES) {
            this.storage = this.storage.slice(-MAX_LOG_ENTRIES);
        };

        this.emit(new LoggerServiceEventMessage(LoggerServiceEvent.LogAdded, newLogEntity));
    }

    private onSnifferLogAdded = (logEntity: LogEntity) => {
        // console.log('onSnifferLogAdded', logEntity);
        
        this.addLog(logEntity.level, logEntity.args, logEntity.source);
    }
}