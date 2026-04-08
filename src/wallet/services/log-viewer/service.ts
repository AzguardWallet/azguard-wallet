import type { ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import { DummyLogger, type ILoggerStore, type Log } from "@/wallet/logger"
import { EventHandler } from "@/wallet/utils/event-handler"
import { type Events, LOG_VIEWER_SERVICE_NAME, type Methods } from "./spec"

export * from "./spec"

export class LogViewerService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
	public static name = LOG_VIEWER_SERVICE_NAME

	public readonly onLog = new EventHandler<Log>()

	private readonly loggerStore: ILoggerStore

	public constructor(logger: ILoggerStore) {
		super(LOG_VIEWER_SERVICE_NAME, new DummyLogger())
		this.loggerStore = logger
		this.loggerStore.onLog.add(this.onLogAdded)
	}

	public async getLogs(count: number, fromId?: number): Promise<Log[]> {
		return this.loggerStore.get(count, fromId)
	}

	public async clearLogs() {
		this.loggerStore.clear()
	}

	private readonly onLogAdded = (log: Log) => {
		this.emit("onLog", log)
	}
}
