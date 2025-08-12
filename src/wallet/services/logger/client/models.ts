import { CircularBuffer } from "@/wallet/utils/arrays";

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
    message: string;
    args?: string[];
    source?: string;
}

export interface ILogs {
    add(log: LogEntity): LogEntity | undefined;
    add(
		level: LogLevel,
		message: string,
		args?: any,
		source?: string,
		origin?: LogOrigin
	): LogEntity | undefined;
    get(count?: number): LogEntity[];
    setDebugMode(isDebug: boolean): void;
}

export interface ILogsAsync {
    addLog(log: LogEntity): Promise<void>;
    addLog(
		level: LogLevel,
		message: string,
		args?: any,
		source?: string,
		origin?: LogOrigin
	): Promise<void>;
    getLogs(count?: number): Promise<LogEntity[]>;
}

export class DummyLogger implements ILogsAsync {
    async addLog(..._args: [LogEntity] | [LogLevel, any, string?, string?, LogOrigin?]): Promise<void> {
        return;
    }

    async getLogs(_count?: number): Promise<LogEntity[]> {
        return [];
    }
}

export class InMemoryLogs implements ILogs {
	private logs: CircularBuffer<LogEntity>;

	constructor(
        private isDebugMode = true
    ) {
		this.logs = new CircularBuffer<LogEntity>(this.getMaxEntries());
	}

	private getMaxEntries(): number {
		return this.isDebugMode ? 10_000 : 1_000;
	}

	private normalizeArgs(args: any): any {
		if (!args || args.length === 0) return undefined;
		if (args.length === 1) {
			if (Array.isArray(args[0]) && !args[0].length) {
				return undefined;
			} else {
				return args[0];
			}
		}

		return args;
	}

    add(...args: [LogEntity] | [LogLevel, string, any[]?, string?, LogOrigin?]): LogEntity | undefined {
		let log: LogEntity;

		if (typeof args[0] === "object" && "level" in args[0]) {
			log = args[0] as LogEntity;
		} else {
			const [level, message, inputArgs, source, origin] = args as [
				LogLevel,
				string,
				any[]?,
				string?,
				LogOrigin?
			];

			if (!this.isDebugMode && level === LogLevel.Debug) return undefined;

			const normArgs = this.normalizeArgs(inputArgs);

			log = {
				origin: origin ?? LogOrigin.BG,
				level,
				ts: Date.now(),
				message,
				args: normArgs,
				source,
			};
		}

		if (!this.isDebugMode && log.level === LogLevel.Debug) return undefined;

		this.logs.add(log);

		return log;
	}

	get(count?: number): LogEntity[] {
		const logs = this.logs.get();
		return count ? logs.slice(-count) : logs;
	}

	setDebugMode(isDebug: boolean): void {
		if (isDebug !== this.isDebugMode) {
			this.isDebugMode = isDebug;
			this.logs.resize(this.getMaxEntries());
		}
	}
}
