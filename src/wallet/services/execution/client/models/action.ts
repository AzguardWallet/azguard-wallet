import { IAuthwitContent } from ".";

export enum ActionKind {
    AddCapsule = "add_capsule",
    AddPrivateAuthwit = "add_private_authwit",
    AddPublicAuthwit = "add_public_authwit",
    Call = "call",
    EncodedCall = "encoded_call",
}

export interface IAction {
    readonly kind: ActionKind;
}

export class AddCapsuleAction implements IAction {
    public readonly kind = ActionKind.AddCapsule;
    public constructor(
        public readonly contract: string,
        public readonly storageSlot: string,
        public readonly capsule: string[],
    ) {}
}

export class AddPrivateAuthwitAction implements IAction {
    public readonly kind = ActionKind.AddPrivateAuthwit;
    public constructor(
        public readonly content: IAuthwitContent,
        public readonly authwit?: string[],
    ) {}
}

export class AddPublicAuthwitAction implements IAction {
    public readonly kind = ActionKind.AddPublicAuthwit;
    public constructor(
        public readonly content: IAuthwitContent,
    ) {}
}

export class CallAction implements IAction {
    public readonly kind = ActionKind.Call;
    public constructor(
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class EncodedCallAction implements IAction {
    public readonly kind = ActionKind.EncodedCall;
    public constructor(
        public readonly to: string,
        public readonly name: string,
        public readonly selector: string,
        public readonly type: string,
        public readonly isStatic: boolean,
        public readonly args: string[],
        public readonly returnTypes: unknown[],
    ) {}
}

