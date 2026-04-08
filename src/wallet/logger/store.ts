import { ConfigProp, IConfig } from "@/wallet/config"
import { EventHandler } from "@/wallet/utils/event-handler"
import { ILoggerStore, Log, LogLevel, CircularBufferIterable, print, trim } from "."

export class LoggerStore implements ILoggerStore {
	public readonly onLog = new EventHandler<Log>()

	private logLevel: LogLevel
	private logs: CircularBufferIterable<Log>
	private nextId = 1
	private flushTimer?: ReturnType<typeof setTimeout>

	public constructor(config: IConfig) {
		this.logLevel = config.get("debugMode") ? LogLevel.Debug : LogLevel.Info
		this.logs = new CircularBufferIterable(this.logLevel === LogLevel.Debug ? 10_000 : 1000)
		config.onUpdate.add(this.onConfigUpdate)
	}

	public get(count: number, fromId?: number): Log[] {
		return this.logs.get(count, fromId ?? 0)
	}

	public clear(): void {
		this.logs.clear()
	}

	public log(source: string, level: LogLevel, ...data: any[]): void {
		if (level < this.logLevel) {
			return
		}
		const log: Log = {
			id: this.nextId++,
			timestamp: Date.now(),
			source,
			level,
			context: "sw",
			data: trim(data),
		}
		this.logs.add(log)
		this.scheduleFlush()
		this.onLog.invoke(log)
		print(log)
	}

	/** Log with explicit context (used by LoggerService for offscreen/popup forwarding). */
	public logWithContext(context: string | undefined, source: string, level: LogLevel, ...data: any[]): void {
		if (level < this.logLevel) {
			return
		}
		const log: Log = {
			id: this.nextId++,
			timestamp: Date.now(),
			source,
			level,
			context: (context as Log["context"]) ?? "sw",
			data: trim(data),
		}
		this.logs.add(log)
		this.scheduleFlush()
		this.onLog.invoke(log)
		print(log)
	}

	/** Rehydrate logs from chrome.storage.session (call on startup before wiring services). */
	public async rehydrate(): Promise<void> {
		try {
			const result = await chrome.storage.session.get("azguard:logs")
			const saved = result["azguard:logs"] as Log[] | undefined
			if (saved?.length) {
				for (const log of saved) {
					this.logs.add(log)
					this.nextId = Math.max(this.nextId, log.id + 1)
				}
			}
		} catch {
			// Session storage may not be available (e.g., in tests)
		}
	}

	/** Debounced flush of recent logs to chrome.storage.session for crash recovery. */
	private scheduleFlush(): void {
		if (this.flushTimer) return
		this.flushTimer = setTimeout(() => {
			this.flushTimer = undefined
			try {
				const items = this.logs.items().slice(-2000)
				chrome.storage.session.set({ "azguard:logs": items })
			} catch {
				// Session storage may not be available
			}
		}, 2000)
	}

	private readonly onConfigUpdate = (prop: ConfigProp) => {
		if (prop.key === "debugMode") {
			this.logLevel = prop.value ? LogLevel.Debug : LogLevel.Info
			this.logs.resize(this.logLevel === LogLevel.Debug ? 10_000 : 1_000)
		}
	}
}
