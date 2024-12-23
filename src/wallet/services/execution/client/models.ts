export enum ActionKind {
    AddCapsule = "add_capsule",
    AddNote = "add_note",
    AddContact = "add_contact",
    AddContract = "add_contract",
    AuthorizeCall = "authorize_call",
    AuthorizeIntent = "authorize_intent",
    Call = "call",
    FunctionCall = "function_call",
}
  
export interface IAction {
    readonly kind: ActionKind;
}

export class AddCapsuleAction implements IAction {
    public readonly kind = ActionKind.AddCapsule;

    constructor(
        public readonly capsule: string[],
    ) {}
}

export class AddNoteAction implements IAction {
    public readonly kind = ActionKind.AddNote;

    constructor(
        public readonly note: string,
    ) {}
}

export class AddContactAction implements IAction {
    public readonly kind = ActionKind.AddContact;

    constructor(
        public readonly address: string,
    ) {}
}

export class AddContractAction implements IAction {
public readonly kind = ActionKind.AddContract;

    constructor(
        public readonly address: string,
        public readonly instance?: unknown,
        public readonly artifact?: unknown,
    ) {}
}

export class AuthorizeCallAction implements IAction {
    public readonly kind = ActionKind.AuthorizeCall;

    constructor(
        public readonly isPublic: boolean,
        public readonly caller: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class AuthorizeIntentAction implements IAction {
    public readonly kind = ActionKind.AuthorizeIntent;

    constructor(
        public readonly isPublic: boolean,
        public readonly consumer: string,
        public readonly intent: string[],
    ) {}
}

export class CallAction implements IAction {
    public readonly kind = ActionKind.Call;

    constructor(
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class FunctionCallAction implements IAction {
    public readonly kind = ActionKind.FunctionCall;

    constructor(
        public readonly to: string,
        public readonly name: string,
        public readonly selector: string,
        public readonly type: string,
        public readonly isStatic: boolean,
        public readonly args: any[],
        public readonly returnTypes: unknown[],
    ) {}
}