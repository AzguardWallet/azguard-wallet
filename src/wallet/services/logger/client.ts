import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { DummyLogger, ILogger, LogLevel } from "@/wallet/logger";
import { LOGGER_SERVICE_NAME, Methods } from "./spec";

export * from "./spec";

export class LoggerServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods>, ILogger {
    public constructor() {
        super(LOGGER_SERVICE_NAME, new DummyLogger());
    }

    public log(source: string, level: LogLevel, ...data: any[]) {
        return this.request("log", source, level, ...data);
    }
}
