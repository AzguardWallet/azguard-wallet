import { IMessage, MessageType } from ".";

export class RequestContent<TMethod, TParams> {
    public readonly requestId: number;
    constructor(
        public readonly method: TMethod,
        public readonly params: TParams,
    ) {
        this.requestId = 1 + Math.random();
    }
}

export class RequestMessage<TMethod, TParams> implements IMessage<RequestContent<TMethod, TParams>> {
    public readonly type = MessageType.Request;
    constructor(
        public readonly content: RequestContent<TMethod, TParams>,
        public readonly from: string,
        public readonly to?: string,
    ) {}
}