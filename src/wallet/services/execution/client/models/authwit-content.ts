export enum AuthwitContentKind {
    Call = "call",
    CallExt = "call_ext",
    Intent = "intent",
    MessageHash = "message_hash",
}

export interface IAuthwitContent {
    readonly kind: AuthwitContentKind,
}

export class CallAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.Call;
    public constructor(
        public readonly caller: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class CallExtAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.CallExt;
    public constructor(
        public readonly caller: string,
        public readonly to: string,
        public readonly name: string,
        public readonly selector: string,
        public readonly type: string,
        public readonly isStatic: boolean,
        public readonly args: string[],
        public readonly returnTypes: unknown[],
    ) {}
}

export class IntentAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.Intent;
    public constructor(
        public readonly consumer: string,
        public readonly intent: string[],
    ) {}
}

export class MessageHashAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.MessageHash;
    public constructor(
        public readonly messageHash: string,
    ) {}
}