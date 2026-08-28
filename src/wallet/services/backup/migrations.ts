/**
 * Backup-file versioning and the legacy-format migrations.
 *
 * BACKUP_VERSION moves independently of the wallet version, the Aztec version and the
 * sentinel: it bumps only when the file format changes. The import upgrades a file
 * through MIGRATIONS step by step before any service sees it, so restore()
 * implementations handle exactly one shape — the current one.
 */

import { BACKUP_ERRORS } from "./spec";

export const BACKUP_VERSION = 0;

export type BackupFile = {
    "backup-version"?: number;
    data: Record<string, unknown>;
    [key: string]: unknown;
};

export function getBackupVersion(backup: BackupFile): number {
    return typeof backup["backup-version"] === "number" ? backup["backup-version"] : 0;
}

/**
 * Brings a parsed backup file to the current format, stamping the version it reached.
 * Refuses a file stamped by a newer wallet — this is the single owner of that check.
 */
export function upgradeBackup(backup: BackupFile): BackupFile {
    let version = getBackupVersion(backup);
    if (version > BACKUP_VERSION) {
        throw new Error(BACKUP_ERRORS.newer);
    }
    let upgraded = backup;
    while (version < BACKUP_VERSION) {
        upgraded = { ...MIGRATIONS[version](upgraded), "backup-version": ++version };
    }
    return upgraded;
}

const MIGRATIONS: Record<number, (backup: BackupFile) => BackupFile> = {};
