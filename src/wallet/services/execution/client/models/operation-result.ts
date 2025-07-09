export enum OperationStatus {
    Ok = "ok",
    Failed = "failed",
    Skipped = "skipped",
}

export interface IOperationResult {
    status: OperationStatus,
}

export class OkOperationResult<T> implements IOperationResult {
    public readonly status = OperationStatus.Ok;
    public constructor(
        public readonly result: T,
    ) {}
}

export class FailedOperationResult implements IOperationResult {
    public readonly status = OperationStatus.Failed;
    public constructor(
        public readonly error: string,
    ) {}
}

export class SkippedOperationResult implements IOperationResult {
    public readonly status = OperationStatus.Skipped;
}