import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";
import { type ILogs, LogLevel, LogOrigin } from "@/wallet/services/logger/client";

export abstract class Service {
    constructor(
        public readonly name: string,
        public readonly logger: ILogs,
        protected readonly emit: (event: EventMessage) => void,
    ) { }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;

    protected log(level: LogLevel, ...args: any[]) {
        this.logger.add(
            level,
            args,
            this.name,
            LogOrigin.BG,
        );
    }

    protected logDebug(...args: any[]) {
        this.log(LogLevel.Debug, args);
    }

    protected logInfo(...args: any[]) {
        this.log(LogLevel.Info, args);
    }

    protected logWarn(...args: any[]) {
        this.log(LogLevel.Warning, args);
    }

    protected logError(...args: any[]) {
        this.log(LogLevel.Error, args);
    }
}
