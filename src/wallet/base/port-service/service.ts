import type { ILogger } from "@/wallet/services/logger/client";
import type { EventMessage, RequestMessage, ResponseMessage } from "./messages";

export abstract class Service {
    constructor(
        public readonly name: string,
        protected readonly emit: (event: EventMessage) => void,
        protected logger?: ILogger,
    ) { }

    protected log(...args: any[]) {
        this.logger?.debug(`${this.name}`, ...args);
    }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;
}