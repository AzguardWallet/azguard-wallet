import { OperationKind, TransferType } from "@/wallet/services/execution/client";
import { TxOrigin } from "@/wallet/services/transaction/client";

export enum TaskStatus {
    Pending,
    Processing,
    Completed,
    Cancelled,
    Failed,
}

export type Task = {
    id: string;
    content: ITaskContent;
    status: TaskStatus;
    createdAt: number;
    startedAt?: number;
    subtasks: Task[];
    origin?: TxOrigin;
    parent?: Task;
    finishedAt?: number;
    result?: ITaskResult;
    error?: string;
};

export enum ContentKind {
    Step,
    BalanceUpdate,
    TokenMint,
    ExecuteOperation,
    Transfer,
    RevokeAuthwits,
}

export interface ITaskContent {
    kind: ContentKind;
    label: string;
    estimatedTime?: number;
}

export class StepContent implements ITaskContent {
    public readonly kind = ContentKind.Step;
    constructor(
        public readonly label: string,
        public readonly estimatedTime?: number,
    ) {}
}

export class BalanceUpdateContent implements ITaskContent {
    public readonly kind = ContentKind.BalanceUpdate;
    public readonly label = "Refresh token balance";
    constructor(
        public readonly tbId: number,
        public readonly estimatedTime?: number,
    ) {}
}

export class TokenMintContent implements ITaskContent {
    public readonly kind = ContentKind.TokenMint;
    public readonly label = "Mint token";
    constructor(
        public readonly name: string,
        public readonly symbol: string,
        public readonly decimals: number,
        public readonly amount: string,
        public readonly estimatedTime?: number,
    ) {}
}

export class ExecuteOperationContent implements ITaskContent {
    public readonly kind = ContentKind.ExecuteOperation;
    public readonly label = "Execute operation";
    constructor(
        public readonly operationKind: OperationKind,
    ) {}
}

export class TransferContent implements ITaskContent {
    public readonly kind = ContentKind.Transfer;
    public readonly label = "Transfer";
    constructor(
        public readonly tokenId: number,
        public readonly transferType: TransferType,
        public readonly recipientAddress: string,
        public readonly amount: bigint,
    ) {}
}

export class RevokeAuthwitsContent implements ITaskContent {
    public readonly kind = ContentKind.RevokeAuthwits;
    public readonly label = "Revoke public authwits";
    constructor(
        public readonly authwitIds: number[],
        public readonly estimatedTime?: number,
    ) {}
}

export enum ResultKind {
    Empty,
}

export interface ITaskResult {
    kind: ResultKind;
}

export class EmptyResult implements ITaskResult {
    public readonly kind = ResultKind.Empty;
}
