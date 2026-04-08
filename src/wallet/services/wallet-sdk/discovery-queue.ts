import type { BackgroundConnectionHandler, PendingDiscovery } from "@aztec/wallet-sdk/extension/handlers"
import type { ILogger } from "@/wallet/logger"
import { LogLevel } from "@/wallet/logger"

const STALE_MS = 5 * 60 * 1000 // 5 minutes

export class DiscoveryQueue {
	private queue: string[] = [] // requestIds

	constructor(
		private handler: BackgroundConnectionHandler,
		private logger: ILogger,
	) {}

	get size(): number {
		return this.queue.length
	}

	/** Queue a discovery and update the badge. */
	enqueue(requestId: string, origin: string): void {
		this.queue.push(requestId)
		this.updateBadge()
		this.logger.log("wallet-sdk", LogLevel.Info, `Discovery queued (wallet locked): ${origin} [queue: ${this.queue.length}]`)
	}

	/**
	 * Drain the queue. Calls `processFn` for each valid, non-stale discovery.
	 * If `processFn` returns false, remaining items are re-queued (wallet locked mid-drain).
	 */
	async drain(processFn: (discovery: PendingDiscovery) => Promise<boolean>): Promise<void> {
		if (this.queue.length === 0) return

		this.logger.log("wallet-sdk", LogLevel.Info, `Draining discovery queue: ${this.queue.length} item(s)`)

		const snapshot = [...this.queue]
		this.queue.length = 0
		this.updateBadge()

		const now = Date.now()
		for (let i = 0; i < snapshot.length; i++) {
			const discovery = this.handler.getPendingDiscovery(snapshot[i])

			if (!discovery || discovery.status !== "pending") {
				this.logger.log(
					"wallet-sdk",
					LogLevel.Info,
					`Discovery skipped (${!discovery ? "gone" : discovery.status}): ${snapshot[i]}`,
				)
				continue
			}

			if (now - discovery.timestamp > STALE_MS) {
				this.handler.rejectDiscovery(discovery.requestId)
				this.logger.log("wallet-sdk", LogLevel.Warn, `Discovery rejected (stale): ${discovery.origin}`)
				continue
			}

			const ok = await processFn(discovery)
			if (!ok) {
				// Wallet locked mid-drain — re-queue this + remaining
				this.queue.push(...snapshot.slice(i))
				this.updateBadge()
				this.logger.log("wallet-sdk", LogLevel.Warn, `Wallet locked during drain, re-queued ${this.queue.length} item(s)`)
				return
			}
		}

		this.logger.log("wallet-sdk", LogLevel.Info, "Discovery queue drain complete")
	}

	private updateBadge(): void {
		const text = this.queue.length > 0 ? String(this.queue.length) : ""
		chrome.action.setBadgeText({ text })
		if (this.queue.length > 0) {
			chrome.action.setBadgeBackgroundColor({ color: "#FF6B00" })
		}
	}
}
