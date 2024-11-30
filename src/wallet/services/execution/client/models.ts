export enum ActionType {
    AddCapsule = "add_capsule",
    AddNote = "add_note",
    AddContact = "add_contact",
    AddContract = "add_contract",
    AuthorizeCall = "authorize_call",
    AuthorizeIntent = "authorize_intent",
    Call = "call",
}
  
export interface IAction {
    readonly type: ActionType;
}

export class AddCapsuleAction implements IAction {
    public readonly type = ActionType.AddCapsule;

    constructor(
        public readonly capsule: string[],
    ) {}
}

export class AddNoteAction implements IAction {
    public readonly type = ActionType.AddNote;

    constructor(
        public readonly note: string,
    ) {}
}

export class AddContactAction implements IAction {
    public readonly type = ActionType.AddContact;

    constructor(
        public readonly address: string,
    ) {}
}

export class AddContractAction implements IAction {
public readonly type = ActionType.AddContract;

    constructor(
        public readonly address: string,
        public readonly instance?: unknown,
        public readonly artifact?: unknown,
    ) {}
}

export class AuthorizeCallAction implements IAction {
    public readonly type = ActionType.AuthorizeCall;

    constructor(
        public readonly registry: boolean,
        public readonly caller: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class AuthorizeIntentAction implements IAction {
    public readonly type = ActionType.AuthorizeIntent;

    constructor(
        public readonly registry: boolean,
        public readonly consumer: string,
        public readonly intent: string[],
    ) {}
}

export class CallAction implements IAction {
    public readonly type = ActionType.Call;

    constructor(
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}