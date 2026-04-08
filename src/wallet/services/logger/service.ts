import type { ServiceSpec } from "@/wallet/base"
import { Service } from "@/wallet/base/background"
import { DummyLogger, type ILogger, type LogLevel, type LoggerStore } from "@/wallet/logger"
import { LOGGER_SERVICE_NAME, type Methods } from "./spec"

export * from "./spec"

export class LoggerService extends Service<Methods> implements ServiceSpec<Methods>, ILogger {
	public static name = LOGGER_SERVICE_NAME

	private readonly _logger: LoggerStore

	public constructor(logger: LoggerStore) {
		super(LOGGER_SERVICE_NAME, new DummyLogger())
		this._logger = logger
	}

	public async log(context: string | undefined, source: string, level: LogLevel, ...data: unknown[]) {
		this._logger.logWithContext(context, source, level, ...data)
	}
}
