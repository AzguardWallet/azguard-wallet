export * from "./eventMessage";
export * from "./requestMessage";
export * from "./responseMessage";

export enum MessageType {
    Event = 1,
    Request = 2,
    Response = 3,
}

export interface IMessage<T> {
    readonly type: MessageType;
    readonly content: T;
    readonly from: string;
    readonly to?: string;
}