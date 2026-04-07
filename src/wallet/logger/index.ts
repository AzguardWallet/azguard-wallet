import { EventHandler } from "@/wallet/utils/event-handler";

export * from "./store";
export * from "./utils";

export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

export type LogContext = "sw" | "offscreen" | "popup" | "content";

export type Log = {
    id: number;
    timestamp: number;
    source: string;
    level: LogLevel;
    context?: LogContext;
    data: any[];
};

export interface ILogger {
    log(source: string, level: LogLevel, ...data: any[]): void;
}

export interface ILoggerStore extends ILogger {
    onLog: EventHandler<Log>;
    get(count: number, fromId?: number): Log[];
    clear(): void;
}

export const consoleMethods: [string, LogLevel][] = [
    ["trace", LogLevel.Debug],
    ["debug", LogLevel.Debug],
    ["log", LogLevel.Info],
    ["info", LogLevel.Info],
    ["warn", LogLevel.Warn],
    ["error", LogLevel.Error],
];
