import { EventMessage, RequestMessage, ResponseMessage } from "./messages";

export abstract class Service {
    constructor(
        public readonly name: string,
        protected readonly emit: (event: EventMessage) => void,
    ) { }

    abstract process(request: RequestMessage): Promise<ResponseMessage | undefined>;
}