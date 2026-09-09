/**
 * The file boundary of a backup: raw text on one side, typed data on the other.
 * Type sniffing, parsing, the checksum and the generation gate all live here, so the
 * restore orchestration only ever sees a validated backup. Optional fields exist only
 * in ParsedBackup — the honest shape of untrusted JSON. Past validateBackup the types
 * are strict.
 */

import { EncryptionKey } from "@/wallet/services/profile/encryption/encryption-key";
import { ProfileInfo, isCurrentGeneration } from "@/wallet/services/profile/spec";
import { BACKUP_ERRORS, BackupFileType } from "./spec";
import { jsonStringify } from "@/wallet/utils/serialization";

/** The raw parse of a backup file — JSON guarantees nothing, so every field is optional. */
export type ParsedBackup = {
    checksum?: string;
    "wallet-version"?: string;
    "aztec-version"?: string;
    "master-key"?: string;
    data?: Record<string, unknown>;
};

/** A backup that passed the checksum and the generation gate. */
export type ValidBackup = {
    profile: ProfileInfo;
    masterKey: string;
    data: Record<string, unknown>;
};

/**
 * Sniffs which container a picked backup file is: plain JSON, the encrypted container
 * (base64 of EncryptionKey's ciphertext), or neither.
 */
export function detectBackupType(text: string): BackupFileType {
    const trimmed = text.trim();

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return "plain";
    }

    try {
        // NOTE: 13 bytes decide the type — decoding the whole base64 of a
        // 100MB+ file freezes the renderer
        const bin = atob(trimmed.slice(0, 32));
        if (EncryptionKey.isSealed(Uint8Array.from(bin, c => c.charCodeAt(0)))) {
            return "encrypted";
        }
    } catch {
        return "unknown";
    }

    return "unknown";
}

/**
 * Seals a backup file into the encrypted container: AES under the
 * password-derived key, then base64.
 */
export async function encryptBackupText(text: string, password: string): Promise<string> {
    const key = await EncryptionKey.fromPassword(password);
    const sealed = await key.encrypt(new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>);
    return Buffer.from(sealed).toString("base64");
}

/**
 * Opens an encrypted backup container: the password-derived key, then AES
 * over the decoded bytes.
 */
export async function decryptBackupText(text: string, password: string): Promise<string> {
    const key = await EncryptionKey.fromPassword(password);
    const decrypted = await key.decrypt(new Uint8Array(Buffer.from(text.trim(), "base64")));
    return new TextDecoder().decode(decrypted);
}

/**
 * Wraps the collected per-service sections into the final file text: version stamps,
 * master key, data, then the checksum over everything so far. Key order is part of the
 * format — exports stay byte-identical across wallet versions.
 */
export async function serializeBackup(
    masterKey: string,
    data: Record<string, unknown>,
    space?: number,
): Promise<string> {
    const file: Record<string, unknown> = {
        "wallet-version": __VERSION__,
        "aztec-version": __AZTEC_VERSION__,
        "master-key": masterKey,
        data,
    };
    // the replacer rides both stringifies instead of a sanitizing pre-pass —
    // at 100MB+ every full pass over the payload is seconds on the worker
    file.checksum = await EncryptionKey.getHashHex(jsonStringify(file));
    return jsonStringify(file, space);
}

export function parseBackupFile(file: string): ParsedBackup {
    try {
        return JSON.parse(file);
    } catch {
        throw new Error("Invalid backup file: not valid JSON");
    }
}

/**
 * Checksum → generation gate, in that order. Throws the matching BACKUP_ERRORS
 * wording, and returns the strictly-typed backup the restore consumes.
 */
export async function validateBackup(parsed: ParsedBackup): Promise<ValidBackup> {
    const { checksum, ...backup } = parsed;
    if (checksum !== (await EncryptionKey.getHashHex(JSON.stringify(backup)))) {
        throw new Error(BACKUP_ERRORS.integrity);
    }

    if (backup.data === undefined) {
        throw new Error("Invalid backup file: no data");
    }

    const profile = backup.data.profile as ProfileInfo | undefined;
    if (!isCurrentGeneration(profile?.origin)) {
        throw new Error(profile?.origin ? BACKUP_ERRORS.incompatible : BACKUP_ERRORS.outdated);
    }

    const masterKey = backup["master-key"];
    if (typeof masterKey !== "string") {
        throw new Error("Invalid backup file: no master key");
    }
    return { profile: profile as ProfileInfo, masterKey, data: backup.data };
}
