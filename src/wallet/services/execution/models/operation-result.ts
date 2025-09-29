export type OperationResult<T = unknown> = OkOperationResult<T> | FailedOperationResult | SkippedOperationResult;

export type OkOperationResult<T> = {
    kind: "ok";
    result: T;
};

export type FailedOperationResult = {
    kind: "failed";
    error: string;
};

export type SkippedOperationResult = {
    kind: "skipped";
};
