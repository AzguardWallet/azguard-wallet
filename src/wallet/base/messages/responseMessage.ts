import { IMessage, MessageType } from "./message";

export abstract class ResponseMessage implements IMessage {
    public readonly type = MessageType.Response;
    public readonly service: string;
    public readonly requestId: number;
    public readonly result?: any;
    public readonly error?: string;

    constructor(service: string, requestId: number, result?: any, error?: string) {
        this.service = service;
        this.requestId = requestId;
        this.result = result;
        this.error = error;
    }
}