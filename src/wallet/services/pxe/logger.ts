import { LogData, LogFn, Logger as AztecLogger } from "@aztec/foundation/log";

const LogLevels = ["silent", "fatal", "error", "warn", "info", "verbose", "debug", "trace"] as const;

type LogErrorFn = LogFn & ((msg: string, err?: Error | unknown, data?: LogData) => void);

export type LogLevel = (typeof LogLevels)[number];

export class Logger implements AztecLogger {
    public readonly silent: LogFn = () => {};
    public readonly fatal: LogFn = () => {};
    public readonly error: LogErrorFn = () => {};
    public readonly warn: LogFn = () => {};
    public readonly info: LogFn = () => {};
    public readonly verbose: LogFn = () => {};
    public readonly debug: LogFn = () => {};
    public readonly trace: LogFn = () => {};

    private readonly levels = new Set<LogLevel>();

    constructor(
        public readonly module: string,
        public readonly level: LogLevel = "info",
    ) {
        for (const logLevel of LogLevels) {
            this.levels.add(logLevel);
            this[logLevel] = (msg: string, ...data: unknown[]) => {
                console.log(`[${new Date().toUTCString()}][${module}][${level}]: ${msg}`, ...data);
            };
            if (logLevel === level) {
                break;
            }
        }
    }

    public isLevelEnabled(level: LogLevel): boolean {
        return this.levels.has(level);
    }
}
