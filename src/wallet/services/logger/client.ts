import { ServiceSpec } from "@/wallet/base"
import { ServiceClient } from "@/wallet/base/background"
import { DummyLogger, ILogger, LogLevel } from "@/wallet/logger"
import { LOGGER_SERVICE_NAME, Methods } from "./spec"

export * from "./spec"

export class LoggerServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods>, ILogger {
	private readonly context?: string

	public constructor(context?: string) {
		super(LOGGER_SERVICE_NAME, new DummyLogger())
		this.context = context
	}

	public log(source: string, level: LogLevel, ...data: unknown[]) {
		return this.request("log", this.context, source, level, ...data)
	}
}
