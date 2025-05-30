export enum TaskStatus {
    Completed = "completed",
    Processing = "processing",
    Failed = "failed",
    Pending = "pending",
}

export enum TaskKind {
    Step = "step",
}

export interface ITask {
    id: string;
    kind: TaskKind;
    content: unknown;
    status: TaskStatus;
    createdAt: number;
    subtasks: ITask[];
    source?: string;
    parentId?: string;
    finishedAt?: number;
    result?: unknown;
    error?: string;
}

export abstract class Task<TContent, TResult> {
    constructor(
        public readonly content: TContent,
        public status: TaskStatus = TaskStatus.Processing,
        public readonly source?: string,
        public readonly createdAt: number = Date.now(),
        public finishedAt?: number,
        public result?: TResult,
        public error?: string,
    ) {}

    abstract readonly kind: TaskKind;
}

export type StepContent = {
    label: string;
    estimatedTime?: number;
};

export type StepResult = undefined;

export class StepTask extends Task<StepContent, StepResult> {
    public readonly kind = TaskKind.Step;
}
