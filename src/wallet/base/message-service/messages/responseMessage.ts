import { IMessage, MessageType } from ".";

export class ResponseContent<T> {
    constructor(
        public readonly requestId: number,
        public readonly result?: T,
        public readonly error?: string,
    ) {}
}

export class ResponseMessage<T> implements IMessage<ResponseContent<T>> {
    public readonly type = MessageType.Response;
    constructor(
        public readonly content: ResponseContent<T>,
        public readonly from: string,
        public readonly to?: string,
    ) {}
}