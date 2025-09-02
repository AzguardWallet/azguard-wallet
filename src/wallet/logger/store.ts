import { ConfigProp, IConfig } from "@/wallet/config";
import { EventHandler } from "@/wallet/utils/event-handler";
import { ILoggerStore, Log, LogLevel, CircularBufferIterable, print, trim } from ".";

export class LoggerStore implements ILoggerStore {
    public readonly onLog = new EventHandler<Log>();

    private logLevel: LogLevel;
    private logs: CircularBufferIterable<Log>;
    private nextId = 1;

    public constructor(config: IConfig) {
        this.logLevel = config.get("debugMode") ? LogLevel.Debug : LogLevel.Info;
        this.logs = new CircularBufferIterable(this.logLevel === LogLevel.Debug ? 10_000 : 1000);
        config.onUpdate.add(this.onConfigUpdate);
    }

    public get(count: number, fromId?: number): Log[] {
        return this.logs.get(count, fromId ?? 0);
    }

    public clear(): void {
        this.logs.clear();
    }

    public log(source: string, level: LogLevel, ...data: any[]): void {
        if (level < this.logLevel) {
            return;
        }
        const log: Log = {
            id: this.nextId++,
            timestamp: Date.now(),
            source,
            level,
            data: trim(data),
        };
        this.logs.add(log);
        this.onLog.invoke(log);
        print(log);
    }

    private readonly onConfigUpdate = (prop: ConfigProp) => {
        if (prop.key === "debugMode") {
            this.logLevel = prop.value ? LogLevel.Debug : LogLevel.Info;
            this.logs.resize(this.logLevel === LogLevel.Debug ? 10_000 : 1000);
        }
    };
}
