import type { Log } from "@/wallet/logger"

export const LOG_VIEWER_SERVICE_NAME = "log-viewer"

export type Methods = {
	getLogs(count: number, fromId?: number): Log[]
	clearLogs(): void
}

export type Events = {
	onLog: Log
}
