import { IMessage, MessageType } from ".";

export class EventContent<TEvent, TPayload> {
    constructor(
        public readonly event: TEvent,
        public readonly payload: TPayload,
    ) {}
}

export class EventMessage<TEvent, TPayload> implements IMessage<EventContent<TEvent, TPayload>> {
    public readonly type = MessageType.Event;
    constructor(
        public readonly content: EventContent<TEvent, TPayload>,
        public readonly from: string,
        public readonly to?: string,
    ) {}
}