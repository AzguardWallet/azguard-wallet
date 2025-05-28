export enum LogLevel {
    Debug = "debug",
    Info = "log",
    Warning = "warn",
    Error = "error",
}

export type LogEntity = {
    level: LogLevel;
    ts: number;
    args: string[];
    message?: string;
    source?: string;
}

export interface ILogs {
    add(log: LogEntity): void;
    get(count?: number): LogEntity[];
}

export class InMemoryLogs implements ILogs {
    private logs: LogEntity[] = [];

    private readonly TTL_MS = 1 * 60 * 60 * 1_000; // 1 Hour
    private readonly MAX_ENTRIES = 1_000; // 1_000 entries

    add(log: LogEntity): void {
        this.logs = this.logs.filter(l => log.ts - l.ts <= this.TTL_MS);

        this.logs.push(log);

        if (this.logs.length > this.MAX_ENTRIES) {
            this.logs = this.logs.slice(-this.MAX_ENTRIES);
        }
    }

    get(count?: number): LogEntity[] {
        return count ? this.logs.slice(-count) : this.logs;
    }
}

export interface ILogger {
    error(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}

export class DummyLogger implements ILogger {
    public error(message: string, ...args: any[]): void {}
    public warn(message: string, ...args: any[]): void {}
    public info(message: string, ...args: any[]): void {}
    public debug(message: string, ...args: any[]): void {}
}
