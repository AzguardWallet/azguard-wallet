/** What an import file is: plain JSON, an encrypted container, or neither. */
export type BackupFileType = "plain" | "encrypted" | "unknown";

/**
 * Abort reasons the file boundary throws. They cross the RPC as plain
 * strings, so the popup matches on these constants.
 */
export const BACKUP_ERRORS = {
    integrity: "Backup integrity check failed",
    incompatible: "The backup belongs to a different network generation",
    outdated: "The backup is from an older wallet generation",
} as const;
