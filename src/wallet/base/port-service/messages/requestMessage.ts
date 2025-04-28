import { IMessage, MessageType } from ".";

export abstract class RequestMessage implements IMessage {
    public readonly type = MessageType.Request;
    public readonly service: string;
    public readonly method: number;
    public readonly requestId: number;

    constructor(service: string, method: number) {
        this.service = service;
        this.method = method;
        this.requestId = 1 + Math.random();
    }
}