import { AuthwitContent } from ".";

export type ActionKind = Action["kind"];

export type Action =
    | AddCapsuleAction
    | AddPrivateAuthwitAction
    | AddPublicAuthwitAction
    | CallAction
    | EncodedCallAction;

export type AddCapsuleAction = {
    readonly kind: "add_capsule";
    readonly contract: string;
    readonly storageSlot: string;
    readonly capsule: string[];
};

export type AddPrivateAuthwitAction = {
    readonly kind: "add_private_authwit";
    readonly content: AuthwitContent;
    readonly authwit?: string[];
};

export type AddPublicAuthwitAction = {
    readonly kind: "add_public_authwit";
    readonly content: AuthwitContent;
};

export type CallAction = {
    readonly kind: "call";
    readonly contract: string;
    readonly method: string;
    readonly args: any[];
};

export type EncodedCallAction = {
    readonly kind: "encoded_call";
    readonly to: string;
    readonly selector: string;
    readonly args: string[];
    name?: string;
    type?: string;
    isStatic?: boolean;
    returnTypes?: unknown[];
};
