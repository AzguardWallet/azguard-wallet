import { Lock } from "./lock";
import { type ILogger, LogLevel } from "@/wallet/logger";

/**
 * Read/write concurrency guard.
 *
 * - `read(fn)`: runs fn immediately, no lock. Multiple reads proceed concurrently.
 * - `write(fn)`: acquires the write lock, serializing writes.
 * - `enterWrite()` / `leaveWrite()`: manual write lock for destructive ops (profile switch/delete).
 *
 * Phase 2 will add reader counting so `enterWrite()` can drain in-flight reads.
 */
export class ReadWriteGuard {
    private readonly writeLock: Lock;
    private readonly name?: string;
    private readonly logger?: ILogger;
    private writeActive = false;

    constructor(name?: string, logger?: ILogger) {
        this.writeLock = new Lock(name ? `${name}:write` : undefined, logger);
        this.name = name;
        this.logger = logger;
    }

    /** Run fn without acquiring the write lock. Multiple reads proceed concurrently. */
    async read<T>(fn: () => Promise<T>): Promise<T> {
        if (this.writeActive && this.logger && this.name) {
            this.logger.log(this.name, LogLevel.Debug, "[RW] read bypassing active write");
        }
        return fn();
    }

    /** Run fn with the write lock held. Writes are serialized. */
    async write<T>(fn: () => Promise<T>): Promise<T> {
        await this.writeLock.enter();
        this.writeActive = true;
        try {
            return await fn();
        } finally {
            this.writeActive = false;
            this.writeLock.leave();
        }
    }

    /** Acquire write lock directly (for destructive ops like profile delete/switch). */
    async enterWrite(): Promise<void> {
        await this.writeLock.enter();
        this.writeActive = true;
    }

    leaveWrite(): void {
        this.writeActive = false;
        this.writeLock.leave();
    }
}
