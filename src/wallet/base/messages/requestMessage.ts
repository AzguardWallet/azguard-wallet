import { IMessage, MessageType } from "./message";

export abstract class RequestMessage implements IMessage {
    public readonly type = MessageType.Request;
    public readonly service: string;
    public readonly method: number;
    public readonly id: number;

    constructor(service: string, method: number) {
        this.service = service;
        this.method = method;
        do { this.id = Math.random(); }
        while (this.id === 0);
    }
}