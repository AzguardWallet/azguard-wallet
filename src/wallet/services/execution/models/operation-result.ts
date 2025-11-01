export type OperationResult<T = unknown> = OkOperationResult<T> | FailedOperationResult | SkippedOperationResult;

export type OkOperationResult<T> = {
    status: "ok";
    result: T;
};

export type FailedOperationResult = {
    status: "failed";
    error: string;
};

export type SkippedOperationResult = {
    status: "skipped";
};
