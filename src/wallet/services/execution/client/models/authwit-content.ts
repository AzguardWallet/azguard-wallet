export enum AuthwitContentKind {
    Call = "call",
    EncodedCall = "encoded_call",
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

export class EncodedCallAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.EncodedCall;
    public constructor(
        public readonly caller: string,
        public readonly to: string,
        public readonly selector: string,
        public readonly args: string[],
        public name?: string,
        public type?: string,
        public isStatic?: boolean,
        public returnTypes?: unknown[],
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