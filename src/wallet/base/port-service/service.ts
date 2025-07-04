import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";
import { type ILogs, type LogLevel, LogOrigin } from "@/wallet/services/logger/client";

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
}
