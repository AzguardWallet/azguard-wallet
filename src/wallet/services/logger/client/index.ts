import { ServiceClient } from "@/wallet/base/port-service/service-client";
import type { EventMessage } from "@/wallet/base/port-service/messages";
import { LoggerServiceEvent, type LoggerServiceEventMessage } from "./events";
import { AddLogRequest, GetLogsRequest } from "./methods";
import { DummyLogger, type ILogsAsync, LogLevel, type LogEntity, type LogOrigin } from "./models";

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
                this.logError([`Unexpected event type ${message.event}`]);
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
     * @param logEntity assembled entity
     * @param level log level
     * @param args log arguments
     * @param message log message
     * @param source log source
     * @param origin log origin
     */
    public async addLog(...args: [LogEntity] | [LogLevel, any, string?, string?, LogOrigin?]): Promise<void> {
        if (typeof args[0] === "object" && "level" in args[0]) {
            const log = args[0] as LogEntity;

            await this.request(new AddLogRequest(
                log.level, log.args, log.message, log.source, log.origin
            ));
		} else {
            const [
                level,
                inputArgs,
                message,
                source,
                origin
            ] = args as [
				LogLevel,
				any,
				string?,
				string?,
				LogOrigin?
			];

            await this.request(new AddLogRequest(level, inputArgs, message, source, origin));
        }
    }
}
