export type AuthwitContent =
    | CallAuthwitContent
    | EncodedCallAuthwitContent
    | IntentAuthwitContent
    | MessageHashAuthwitContent;

export type CallAuthwitContent = {
    readonly kind: "call";
    readonly caller: string;
    readonly contract: string;
    readonly method: string;
    readonly args: any[];
};

export type EncodedCallAuthwitContent = {
    readonly kind: "encoded_call";
    readonly caller: string;
    readonly to: string;
    readonly selector: string;
    readonly args: string[];
    name?: string;
    type?: string;
    isStatic?: boolean;
    returnTypes?: unknown[];
};

export type IntentAuthwitContent = {
    readonly kind: "intent";
    readonly consumer: string;
    readonly intent: string[];
};

export type MessageHashAuthwitContent = {
    readonly kind: "message_hash";
    readonly messageHash: string;
};
