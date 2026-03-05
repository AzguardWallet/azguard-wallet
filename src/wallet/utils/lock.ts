import { type ILogger, LogLevel } from "@/wallet/logger";

/** Maximum time a lock can be held before being force-released (ms). */
const MAX_HOLD_MS = 5 * 60_000; // 5 minutes

export class Lock {
	private readonly queue: ((value: void) => void)[] = [];
	private locked = false;
	private readonly name?: string;
	private readonly logger?: ILogger;
	private acquiredAt = 0;
	private forceReleaseTimer?: NodeJS.Timeout;

	constructor(name?: string, logger?: ILogger) {
		this.name = name;
		this.logger = logger;
	}

	public async enter() {
		const waiting = this.locked;
		const start = this.logger ? Date.now() : 0;
		if (waiting && this.logger) {
			this.logger.log(this.name!, LogLevel.Debug, `Lock: waiting (queue: ${this.queue.length})`);
		}
		await new Promise<void>((resolve) => {
			this.queue.push(resolve);
			this.dispatch();
		});
		if (this.logger) {
			const waited = Date.now() - start;
			if (waited > 50) {
				this.logger.log(this.name!, LogLevel.Debug, `Lock: acquired (waited ${waited}ms)`);
			}
			this.acquiredAt = Date.now();
		}
		// Safety net: force-release if holder never calls leave()
		this.forceReleaseTimer = setTimeout(() => {
			if (this.locked) {
				if (this.logger) {
					this.logger.log(this.name!, LogLevel.Error, `Lock: force-released after ${MAX_HOLD_MS}ms (holder did not call leave)`);
				}
				this.leave();
			}
		}, MAX_HOLD_MS);
	}

	public leave() {
		if (this.forceReleaseTimer) {
			clearTimeout(this.forceReleaseTimer);
			this.forceReleaseTimer = undefined;
		}
		if (this.logger && this.acquiredAt) {
			const held = Date.now() - this.acquiredAt;
			if (held > 100) {
				this.logger.log(this.name!, LogLevel.Debug, `Lock: released (held ${held}ms)`);
			}
			this.acquiredAt = 0;
		}
		this.locked = false;
		this.dispatch();
	}

	private dispatch() {
		if (!this.locked && this.queue.length) {
			this.locked = true;
			this.queue.shift()!();
		}
	}
}
