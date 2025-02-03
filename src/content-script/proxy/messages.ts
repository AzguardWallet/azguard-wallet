export enum ProxyMessageType {
    Event,
    Request,
    Response,
}

export interface IProxyMessage {
    readonly type: ProxyMessageType;
}

export class ProxyRequestMessage implements IProxyMessage {
    public readonly type = ProxyMessageType.Request;
    public constructor(
        public readonly requestId: number,
        public readonly method: string,
        public readonly payload: any,
    ) {}
}

export class ProxyResponseMessage implements IProxyMessage {
    public readonly type = ProxyMessageType.Response;
    public constructor(
        public readonly requestId: number,
        public readonly result?: any,
        public readonly error?: string,
    ) {}
}

export class ProxyEventMessage implements IProxyMessage {
    public readonly type = ProxyMessageType.Event;
    public constructor(
        public readonly event: string,
        public readonly payload: any,
    ) {}
}