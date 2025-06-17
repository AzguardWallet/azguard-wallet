import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";
import type { ILogs, LogEntity, LogLevel } from "@/wallet/services/logger/client";

export abstract class Service {
    constructor(
        public readonly name: string,
        public readonly logger: ILogs,
        protected readonly emit: (event: EventMessage) => void,
    ) { }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;

    protected log(level: LogLevel, args: any, message?: string) {
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

        const newLogEntity: LogEntity = {
            level,
            ts: Date.now(),
            args: stringArgs,
            message,
            source: `background-${this.name}`,
        };

        this.logger.add(newLogEntity);
    }
}