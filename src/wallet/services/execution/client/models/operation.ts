import { IAction } from ".";

export enum OperationKind {
    AddNote = "add_note",
    GetCompleteAddress = "get_complete_address",
    RegisterContract = "register_contract",
    RegisterSender = "register_sender",
    SendTransaction = "send_transaction",
    SimulateTransaction = "simulate_transaction",
    SimulateUnconstrained = "simulate_unconstrained",
}

export interface IOperation {
    readonly kind: OperationKind;
}

export class AddNoteOperation implements IOperation {
    public readonly kind = OperationKind.AddNote;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly note: unknown,
    ) {}
}

export class GetCompleteAddressOperation implements IOperation {
    public readonly kind = OperationKind.GetCompleteAddress;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
    ) {}
}

export class RegisterContractOperation implements IOperation {
    public readonly kind = OperationKind.RegisterContract;
    public constructor(
        public readonly networkId: string,
        public readonly address: string,
        public readonly instance?: unknown,
        public readonly artifact?: unknown,
    ) {}
}

export class RegisterSenderOperation implements IOperation {
    public readonly kind = OperationKind.RegisterSender;
    public constructor(
        public readonly networkId: string,
        public readonly address: string,
    ) {}
}

export class SendTransactionOperation implements IOperation {
    public readonly kind = OperationKind.SendTransaction;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly actions: IAction[],
        public readonly setup?: IAction[],
    ) {}
}

export class SimulateTransactionOperation implements IOperation {
    public readonly kind = OperationKind.SimulateTransaction;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly actions: IAction[],
        public readonly setup?: IAction[],
        public readonly simulatePublic?: boolean,
    ) {}
}

export class SimulateUnconstrainedOperation implements IOperation {
    public readonly kind = OperationKind.SimulateUnconstrained;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}
