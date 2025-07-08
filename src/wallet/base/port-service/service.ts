import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";
import { type ILogs, LogLevel, LogOrigin } from "@/wallet/services/logger/client";

export abstract class Service {
    constructor(
        public readonly name: string,
        public readonly logger: ILogs,
        protected readonly emit: (event: EventMessage) => void,
    ) { }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;

    protected log(level: LogLevel, args: any, message?: string) {
        this.logger.add(
            level,
            args,
            message,
            this.name,
            LogOrigin.BG,
        );
    }

    protected logDebug(args: any, message?: string) {
        this.log(LogLevel.Debug, args, message);
    }

    protected logInfo(args: any, message?: string) {
        this.log(LogLevel.Info, args, message);
    }

    protected logWarn(args: any, message?: string) {
        this.log(LogLevel.Warning, args, message);
    }

    protected logError(args: any, message?: string) {
        this.log(LogLevel.Error, args, message);
    }
}
