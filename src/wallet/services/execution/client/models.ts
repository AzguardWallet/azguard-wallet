export enum ActionType {
    AddCapsule,
    AddNote,
    AddContact,
    AuthorizeCall,
    AuthorizeMessage,
    Call,
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
        public readonly owner: string,
        public readonly contract: string,
        public readonly storageSlot: string,
        public readonly noteTypeId: string,
        public readonly txHash: string,
    ) {}
}

export class AddRecipientAction implements IAction {
    public readonly type = ActionType.AddContact;

    constructor(
        public readonly address: string,
    ) {}
}

export class AuthorizeCallAction implements IAction {
    public readonly type = ActionType.AuthorizeCall;

    constructor(
        public readonly inPublic: boolean,
        public readonly consumer: string,
        public readonly caller: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class AuthorizeMessageAction implements IAction {
    public readonly type = ActionType.AuthorizeMessage;

    constructor(
        public readonly inPublic: boolean,
        public readonly consumer: string,
        public readonly message: string,
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