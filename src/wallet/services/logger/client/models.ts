export enum LogOrigin {
    BG = "BG",
    UI = "UI",
    OF = "OF",
}

export enum LogLevel {
    Debug = "debug",
    Info = "log",
    Warning = "warn",
    Error = "error",
}

export type LogEntity = {
    origin: LogOrigin;
    level: LogLevel;
    ts: number;
    args: string[];
    message?: string;
    source?: string;
}

export interface ILogs {
    setDebugLogging(enabled: boolean): void;
    add(log: LogEntity): void;
    get(count?: number): LogEntity[];
}

export interface ILogsAsync {
    addLog(log: LogEntity): Promise<void>;
    getLogs(count?: number): Promise<LogEntity[]>;
}

export class DummyLogger implements ILogsAsync {
    async addLog(log: LogEntity): Promise<void> {
        return;
    }

    async getLogs(count?: number): Promise<LogEntity[]> {
        return [];
    }
}

export class InMemoryLogs implements ILogs {
    private logs: LogEntity[] = [];

    private readonly TTL_MS = 1 * 60 * 60 * 1_000; // 1 Hour
    private maxEntries!: number;
    private logDebug = false;

    constructor(logDebug = false) {
		this.setDebugLogging(logDebug);
	}

    setDebugLogging(enabled: boolean): void {
		this.logDebug = enabled;
		this.maxEntries = this.logDebug ? 10_000 : 1_000;
	}

    add(log: LogEntity): void {
        if (log.level === LogLevel.Debug && !this.logDebug) return;

        this.logs = this.logs.filter(l => log.ts - l.ts <= this.TTL_MS);

        this.logs.push(log);

        if (this.logs.length > this.maxEntries) {
            this.logs = this.logs.slice(-this.maxEntries);
        }
    }

    get(count?: number): LogEntity[] {
        return count ? this.logs.slice(-count) : this.logs;
    }
}
