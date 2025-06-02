export enum TaskStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

export type Task = {
    id: string;
    content: ITaskContent;
    status: TaskStatus;
    createdAt: number;
    startedAt?: number;
    subtasks: Task[];
    source?: string;
    parent?: Task;
    finishedAt?: number;
    result?: ITaskResult;
    error?: string;
};

export enum ContentKind {
    Step,
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

export enum ResultKind {
    Empty,
}

export interface ITaskResult {
    kind: ResultKind;
}

export class EmptyResult implements ITaskResult {
    public readonly kind = ResultKind.Empty;
}
