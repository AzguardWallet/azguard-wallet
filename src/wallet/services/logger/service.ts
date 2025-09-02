import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { DummyLogger, ILogger, LogLevel } from "@/wallet/logger";
import { LOGGER_SERVICE_NAME, Methods } from "./spec";

export * from "./spec";

export class LoggerService extends Service<Methods> implements ServiceSpec<Methods>, ILogger {
    public static name = LOGGER_SERVICE_NAME;

    private readonly _logger: ILogger;

    public constructor(logger: ILogger) {
        super(LOGGER_SERVICE_NAME, new DummyLogger());
        this._logger = logger;
    }

    public async log(source: string, level: LogLevel, ...data: any[]) {
        this._logger.log(source, level, ...data);
    }
}
