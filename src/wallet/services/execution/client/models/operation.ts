import { CallAction, EncodedCallAction, FeeSettings, IAction } from ".";

export enum OperationKind {
    GetCompleteAddress = "get_complete_address",
    RegisterContract = "register_contract",
    RegisterSender = "register_sender",
    RegisterToken = "register_token",
    SendTransaction = "send_transaction",
    SimulateTransaction = "simulate_transaction",
    SimulateUtility = "simulate_utility",
    SimulateViews = "simulate_views",
}

export interface IOperation {
    readonly kind: OperationKind;
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

export class RegisterTokenOperation implements IOperation {
    public readonly kind = OperationKind.RegisterToken;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly address: string,
    ) {}
}

export class SendTransactionOperation implements IOperation {
    public readonly kind = OperationKind.SendTransaction;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly feeSettings: FeeSettings,
        public readonly actions: IAction[],
        public setup?: IAction[],
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

export class SimulateUtilityOperation implements IOperation {
    public readonly kind = OperationKind.SimulateUtility;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly contract: string,
        public readonly method: string,
        public readonly args: any[],
    ) {}
}

export class SimulateViewsOperation implements IOperation {
    public readonly kind = OperationKind.SimulateViews;
    public constructor(
        public readonly networkId: string,
        public readonly accountAddress: string,
        public readonly calls: (CallAction | EncodedCallAction)[],
    ) {}
}
