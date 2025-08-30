import type { LogLevel } from "@/wallet/logger";

export const LOGGER_SERVICE_NAME = "logger";

export type Methods = {
    /**
     * Proxies the data to the app logger
     * @param source Log source
     * @param level Log level
     * @param data Data
     */
    log(source: string, level: LogLevel, ...data: any[]): void;
};
