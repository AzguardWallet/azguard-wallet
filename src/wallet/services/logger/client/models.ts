export enum LogLevel {
    Debug = "debug",
    Info = "log",
    Warning = "warn",
    Error = "error",
}

export type LogEntity = {
    level: LogLevel;
    args: string[];
    ts: number;
    source?: string;
}
