import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";
import { type ILogs, LogLevel, LogOrigin } from "@/wallet/services/logger/client";

export abstract class Service {
    constructor(
        public readonly name: string,
        public readonly logger: ILogs,
        protected readonly emit: (event: EventMessage) => void,
    ) { }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;

    protected log(level: LogLevel, message: string, ...args: any[]) {
        this.logger.add(
            level,
            message,
            args,
            this.name,
            LogOrigin.BG,
        );
    }

    protected logDebug(message: string, ...args: any[]) {
        this.log(LogLevel.Debug, message, ...args);
    }

    protected logInfo(message: string, ...args: any[]) {
        this.log(LogLevel.Info, message, ...args);
    }

    protected logWarn(message: string, ...args: any[]) {
        this.log(LogLevel.Warning, message, ...args);
    }

    protected logError(message: string, ...args: any[]) {
        this.log(LogLevel.Error, message, ...args);
    }
}
