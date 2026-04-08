import type { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { DummyLogger, type Log } from "@/wallet/logger"
import { EventHandler } from "@/wallet/utils/event-handler"
import { LOG_VIEWER_SERVICE_NAME, type Methods, type Events } from "./spec"

export * from "./spec"

export class LogViewerServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
	public readonly onLog = new EventHandler<Log>()

	public constructor() {
		super(LOG_VIEWER_SERVICE_NAME, new DummyLogger())
	}

	public getLogs(count: number, fromId?: number): Promise<Log[]> {
		return this.request("getLogs", count, fromId)
	}

	public clearLogs(): Promise<void> {
		return this.request("clearLogs")
	}
}
