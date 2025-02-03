export enum AuthwitContentKind {
    Call = "call",
    Intent = "intent",
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

export class IntentAuthwitContent implements IAuthwitContent {
    public readonly kind = AuthwitContentKind.Intent;
    public constructor(
        public readonly consumer: string,
        public readonly intent: string[],
    ) {}
}