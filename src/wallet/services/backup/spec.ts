export const BACKUP_SERVICE_NAME = "backup";

/** What an import file is: plain JSON, an encrypted container, or neither. */
export type BackupFileType = "plain" | "encrypted" | "unknown";

/**
 * Abort reasons the backup service throws. They cross the RPC as plain
 * strings, so the popup matches on these constants.
 */
export const BACKUP_ERRORS = {
    integrity: "Backup integrity check failed",
    incompatible: "The backup belongs to a different network generation",
    outdated: "The backup is from an older wallet generation",
    superseded: "The backup operation was superseded by a newer one",
} as const;

/** What beginExport starts: the op ticket and how many chunks to fetch. */
export type StartedExport = { op: number; chunks: number };

/**
 * Every begin* mints an op ticket and starts a job under it; each later call names its
 * job by the ticket. A newer begin* evicts the current job (a second window starting
 * its own), and the evicted job's calls fail with BACKUP_ERRORS.superseded instead of
 * feeding the winner's transfer.
 */
export type Methods = {
    /**
     * Assembles the backup file from every service's backup() and holds it for download.
     * @param masterKey The profile's master key, embedded in the file.
     * @param encryptionPassword When given, the file is sealed into the
     *                           encrypted container before splitting.
     * @returns The started job and its chunk count.
     */
    beginExport(masterKey: string, encryptionPassword?: string): StartedExport;

    /**
     * Returns one chunk of the export job. An invalid index kills the job.
     * @param op The job's op ticket.
     * @param index Zero-based chunk index.
     */
    getExportChunk(op: number, index: number): string;

    /**
     * Releases the export job. A stale op is already gone — a no-op.
     * @param op The job's op ticket.
     */
    finishExport(op: number): void;
};

export type Events = {};
