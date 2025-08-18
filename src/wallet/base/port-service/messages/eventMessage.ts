import { type IMessage, MessageType } from ".";

export abstract class EventMessage implements IMessage {
    public readonly type = MessageType.Event;
    public readonly service: string;
    public readonly event: number;

    constructor(service: string, event: number) {
        this.service = service;
        this.event = event;
    }
}