import {
    OperationKind,
    ActionKind,
    AuthwitContentKind,
    OperationStatus,
} from "@/wallet/services/execution/client";

export {
    OperationKind,
    ActionKind,
    AuthwitContentKind,
    OperationStatus,
} from "@/wallet/services/execution/client";

export type CaipChain = `aztec:${number}`;

export type CaipAccount = `${CaipChain}:${string}`;

export type ExecutionParams = {
    sessionId: string,
    operations: Operation[],
}

export type Operation = 
    AddNoteOperation |
    RegisterContractOperation |
    RegisterSenderOperation |
    SendTransactionOperation | 
    SimulateTransactionOperation | 
    SimulateUnconstrainedOperation;

export type AddNoteOperation = {
    kind: OperationKind.AddNote,
    account: CaipAccount,
    note: unknown,
}

export type RegisterContractOperation = {
    kind: OperationKind.RegisterContract,
    chain: CaipChain,
    address: string,
    instance?: unknown,
    artifact?: unknown,
}

export type RegisterSenderOperation = {
    kind: OperationKind.RegisterSender,
    chain: CaipChain,
    address: string,
}

export type SendTransactionOperation = {
    kind: OperationKind.SendTransaction,
    account: CaipAccount,
    actions: Action[],
    setup?: Action[],
}

export type SimulateTransactionOperation = {
    kind: OperationKind.SimulateTransaction,
    account: CaipAccount,
    actions: Action[],
    setup?: Action[],
    simulatePublic?: boolean,
}

export type SimulateUnconstrainedOperation = {
    kind: OperationKind.SimulateUnconstrained,
    account: CaipAccount,
    contract: string,
    method: string,
    args: any[],
}

export type Action = 
    AddCapsuleAction |
    AddPrivateAuthwitAction |
    AddPublicAuthwitAction |
    CallAction |
    CallExtAction;

export type AddCapsuleAction = {
    kind: ActionKind.AddCapsule,
    contract: string,
    storageSlot: string,
    capsule: string[],
}

export type AddPrivateAuthwitAction = {
    kind: ActionKind.AddPrivateAuthwit,
    content: AuthwitContent,
    authwit?: string[],
}

export type AddPublicAuthwitAction = {
    kind: ActionKind.AddPublicAuthwit,
    content: AuthwitContent,
}

export type CallAction = {
    kind: ActionKind.Call,
    contract: string,
    method: string,
    args: any[],
}

export type CallExtAction = {
    kind: ActionKind.CallExt,
    to: string,
    name: string,
    selector: string,
    type: string,
    isStatic: boolean,
    args: string[],
    returnTypes: unknown[],
}

export type AuthwitContent =
    CallAuthwitContent |
    CallExtAuthwitContent |
    IntentAuthwitContent |
    MessageHashAuthwitContent;

export type CallAuthwitContent = {
    kind: AuthwitContentKind.Call,
    caller: string,
    contract: string,
    method: string,
    args: any[],
}

export type CallExtAuthwitContent = {
    kind: AuthwitContentKind.CallExt,
    caller: string,
    to: string,
    name: string,
    selector: string,
    type: string,
    isStatic: boolean,
    args: string[],
    returnTypes: unknown[],
}

export type IntentAuthwitContent = {
    kind: AuthwitContentKind.Intent,
    consumer: string,
    intent: string[],
}

export type MessageHashAuthwitContent = {
    kind: AuthwitContentKind.MessageHash,
    messageHash: string,
}

export type OperationResult = 
    OkOperationResult |
    FailedOperationResult |
    SkippedOperationResult;

export type OkOperationResult = {
    kind: OperationStatus.Ok,
    result: unknown,
}

export type FailedOperationResult = {
    kind: OperationStatus.Failed,
    error: string,
}

export type SkippedOperationResult = {
    kind: OperationStatus.Skipped,
}