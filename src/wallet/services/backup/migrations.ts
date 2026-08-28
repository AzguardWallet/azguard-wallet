/**
 * Backup-file versioning and the legacy-format migrations.
 *
 * BACKUP_VERSION moves independently of the wallet version, the Aztec version and the
 * sentinel: it bumps only when the file format changes. The import upgrades a file
 * through MIGRATIONS step by step before any service sees it, so restore()
 * implementations handle exactly one shape — the current one.
 */

import { BACKUP_ERRORS } from "./spec";

export const BACKUP_VERSION = 1;

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

// TODO: `sentinel-11` every transform below exists for backups exported within sentinel 11.
// At the next sentinel bump, delete the transforms and their tests — the import's generation
// check refuses cross-sentinel files, so none of these shapes can reach the import.

/**
 * v0 → v1. Under v0, account-state contracts could inline their artifact per entry
 * (pre-dedup, wallet ≤0.15.x).
 */
function upgradeV0(backup: BackupFile): BackupFile {
    const data = { ...backup.data };

    if (Array.isArray(data["account-state"])) {
        data["account-state"] = data["account-state"].map(normalizePreDedup);
    }

    return { ...backup, data };
}

type PreDedupContract = {
    address: string;
    instance: { originalContractClassId: unknown };
    artifact?: unknown;
    classId?: string;
};
type AccountStateItem = {
    contracts?: PreDedupContract[];
    artifacts?: Record<string, unknown>;
};

/**
 * Folds a pre-dedup account-state item (artifact inline per contract, no artifacts map)
 * into the current shape. The class id needs no computation — entries of either shape carry
 * it in instance.originalContractClassId. Current-shape items pass through unchanged.
 */
function normalizePreDedup(item: AccountStateItem): AccountStateItem {
    if (!Array.isArray(item.contracts)) {
        return item;
    }
    const artifacts = { ...item.artifacts };
    const contracts = item.contracts.map(contract => {
        if (!("artifact" in contract)) {
            return contract;
        }
        const { artifact, ...rest } = contract;
        const classId = String(rest.instance.originalContractClassId);
        artifacts[classId] ??= artifact;
        return { ...rest, classId };
    });
    return { ...item, contracts, artifacts };
}

const MIGRATIONS: Record<number, (backup: BackupFile) => BackupFile> = {
    0: upgradeV0,
};
