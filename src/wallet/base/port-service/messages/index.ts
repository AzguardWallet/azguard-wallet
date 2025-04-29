export * from './eventMessage';
export * from './requestMessage';
export * from './responseMessage';

export interface IMessage {
    readonly type: MessageType;
    readonly service: string;
}

export enum MessageType {
    Event,
    Request,
    Response,
}