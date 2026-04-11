import type { LogLevel } from "@/wallet/logger"

export const LOGGER_SERVICE_NAME = "logger"

export type Methods = {
	/**
	 * Proxies the data to the app logger
	 * @param context Execution context ("offscreen" | "popup" | etc.)
	 * @param source Log source (service name)
	 * @param level Log level
	 * @param data Data
	 */
	log(context: string | undefined, source: string, level: LogLevel, ...data: unknown[]): void
}
