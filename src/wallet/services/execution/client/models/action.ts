import { IAuthwitContent } from ".";

export enum ActionKind {
    AddCapsule = "add_capsule",
    AddPrivateAuthwit = "add_private_authwit",
    AddPublicAuthwit = "add_public_authwit",
    Call = "call",

    // redundant
    CallExt = "call_ext",
}

export interface IAction {
    readonly kind: ActionKind;
}

export class AddCapsuleAction implements IAction {
    public readonly kind = ActionKind.AddCapsule;
    public constructor(
        public readonly capsule: string[],
    ) {}
}

export class AddPrivateAuthwitAction implements IAction {
    public readonly kind = ActionKind.AddPrivateAuthwit;
    public constructor(
        public readonly content: IAuthwitContent,
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

// redundant
export class CallExtAction implements IAction {
    public readonly kind = ActionKind.CallExt;
    public constructor(
        public readonly to: string,
        public readonly name: string,
        public readonly selector: string,
        public readonly type: string,
        public readonly isStatic: boolean,
        public readonly args: any[],
        public readonly returnTypes: unknown[],
    ) {}
}

