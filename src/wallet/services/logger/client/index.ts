import { ServiceClient } from "@/wallet/base/port-service/service-client";
import type { EventMessage } from "@/wallet/base/port-service/messages";
import { LoggerServiceEvent, type LoggerServiceEventMessage } from "./events";
import { AddLogRequest, GetLogsRequest } from "./methods";
import { DummyLogger, type ILogsAsync, LogLevel, type LogEntity } from "./models";

export * from './events';
export * from './methods';
export * from './models';

export const LOGGER_SERVICE_NAME = "logger";

/**
 * Client for collecting logs via messaging API
 */
export class LoggerServiceClient extends ServiceClient implements ILogsAsync {
    /**
     * Creates LoggerServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onLogAdded Callback, called when a new log entity was added.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onLogAdded?: (logEntity: LogEntity) => void,
    ) {
        super(LOGGER_SERVICE_NAME, new DummyLogger, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case LoggerServiceEvent.LogAdded:
                if (this.onLogAdded) {
                    try {this.onLogAdded((message as LoggerServiceEventMessage).logEntity);}
                    catch {}
                }
                break;
            default:
                this.log(LogLevel.Error, [`Unexpected event type ${message.event}`]);
                // console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of logs.
     * @param count number of logs to return if 0 returned all logs
     */
    public getLogs(count?: number): Promise<LogEntity[]> {
        return this.request(new GetLogsRequest(count));
    }

    /**
     * Adds a new log entity.
     * @param level log level
     * @param args log arguments
     * @param message log message
     * @param source log source
     */
    public async addLog(log: LogEntity): Promise<void> {
        await this.request(new AddLogRequest(log.level, log.args, log.message, log.source));
    }

    public addLogFull(level: LogLevel, args: any, message?: string, source?: string): Promise<LogEntity> {
        return this.request(new AddLogRequest(level, args, message, source));
    }
}
