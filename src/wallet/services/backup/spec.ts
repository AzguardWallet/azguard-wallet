import { ProfileInfo, ProfileType } from "@/wallet/services/profile/spec";

export const BACKUP_SERVICE_NAME = "backup";

/** What an import file is: plain JSON, an encrypted container, or neither. */
export type BackupFileType = "plain" | "encrypted" | "unknown";

/** The service's verdict on the uploaded file: what the popup does next. */
export type ImportStage = "unrecognized" | "needs-password" | "ready";

export type BackupInspection = {
    stage: ImportStage;
    /** The profile in the file — non-null exactly when the stage is "ready". */
    profileType: ProfileType | null;
    profileName: string | null;
};

/**
 * Abort reasons the backup service throws. They cross the RPC as plain
 * strings, so the popup matches on these constants.
 */
export const BACKUP_ERRORS = {
    integrity: "Backup integrity check failed",
    incompatible: "The backup belongs to a different network generation",
    outdated: "The backup is from an older wallet generation",
    noNetworks: "Unable to restore any networks, import aborted",
    profileExists: "Profile already exists, import aborted",
    superseded: "The backup operation was superseded by a newer one",
    sessionOpen: "A profile session is open, import aborted",
} as const;

/**
 * Import outcome: the restored profile (so the popup can offer it for unlock) plus each
 * service's restore failures, keyed by service name. Never echoes backup payloads.
 */
export type ImportReport = {
    profile: ProfileInfo;
    /**
     * Failed items per service: the whole failed item for most services
     * (a config failure keeps its key, a contact its id), and
     * for account-state one entry per network — { networkId, contracts, senders } holding
     * only the failed records. restoreError is flattened to its message. Consumed by the
     * popup's data viewer, which renders arbitrary JSON — hence no per-service typing.
     */
    failures: Record<string, unknown[]>;
};

/** What beginExport starts: the op ticket and how many chunks to fetch. */
export type StartedExport = { op: number; chunks: number };

/**
 * Every begin* mints an op ticket and starts a job under it; each later call names its
 * job by the ticket. A newer begin* evicts the current job (the popup re-picking a
 * file, a second window starting its own), and the evicted job's calls fail with
 * BACKUP_ERRORS.superseded instead of feeding the winner's transfer.
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

    /**
     * Starts an import job expecting the declared number of chunks.
     * Refuses while a profile session is open.
     * @param chunks How many chunks the client will send.
     * @returns The job's op ticket.
     */
    beginImport(chunks: number): number;

    /**
     * Receives one chunk of the import job. A protocol violation kills the job.
     * @param op The job's op ticket.
     * @param index Zero-based chunk index.
     * @param data The chunk text.
     */
    putImportChunk(op: number, index: number, data: string): void;

    /**
     * The service's verdict on the uploaded file: unrecognized, needs a password,
     * or ready — with the file's profile once it parses to one. The job survives
     * for decryptImport and finishImport.
     * @param op The job's op ticket.
     */
    inspectImport(op: number): BackupInspection;

    /**
     * Releases the import job without restoring it — the picked file was abandoned.
     * A stale op is already gone — a no-op.
     * @param op The job's op ticket.
     */
    abortImport(op: number): void;

    /**
     * Decrypts the job's encrypted file in place with the given password and
     * re-inspects it. A wrong password throws and leaves the job untouched.
     * @param op The job's op ticket.
     * @param password Password the file was encrypted with.
     */
    decryptImport(op: number, password: string): BackupInspection;

    /**
     * Runs the full restore of the job's file, then drops it from memory, win or lose.
     * Refuses while a profile session is open.
     * @param op The job's op ticket.
     * @param password Password of the profile in the backup, when its type needs one.
     */
    finishImport(op: number, password?: string): ImportReport;
};

export type Events = {};
