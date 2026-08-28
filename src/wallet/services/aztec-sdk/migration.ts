import { EntityStorage, StorageType } from "@/wallet/storage";
import { CONNECTED_APPS_STORAGE_ROOT, getConnectedAppKey } from "./spec";
import { DAPP_SESSIONS_STORAGE_ROOT } from "@/wallet/services/dapp-session/spec";

/** A connected-app record as written before the per-profile keying: no profileId field. */
type LegacyConnectedApp = {
    id: string;
    profileId?: string;
    origin: string;
    chainId: number;
    dappSessionId: string;
    connectedAt: number;
    autoApprove: boolean;
};

/**
 * Moves connected-app records written before the per-profile keying (key
 * [appId, origin, chainId], no profileId field) under the current 4-part key,
 * backfilling profileId from the record's dapp session. A legacy record whose
 * session is gone is deleted, because nothing can resolve its profile anymore.
 * Reads the raw tables by storage root on purpose: the session lookup must see every
 * profile's sessions, and the service-level read is scoped to the active profile.
 * No drop horizon: extension updates jump straight from any old build, so a legacy
 * record can first appear at any future update.
 */
export async function migrateLegacyConnectedApps(log: (...args: unknown[]) => void): Promise<void> {
    const apps = new EntityStorage<LegacyConnectedApp>(CONNECTED_APPS_STORAGE_ROOT, StorageType.Local);
    const legacy = (await apps.getAll()).filter(([, record]) => record.profileId === undefined);
    if (!legacy.length) {
        return;
    }

    const sessions = new EntityStorage<{ id: string; profileId: string }>(DAPP_SESSIONS_STORAGE_ROOT, StorageType.Local);
    const sessionProfiles = new Map((await sessions.getValues()).map(x => [x.id, x.profileId]));

    let migrated = 0;
    let dropped = 0;
    for (const [key, record] of legacy) {
        const profileId = sessionProfiles.get(record.dappSessionId);
        if (profileId !== undefined) {
            await apps.set(getConnectedAppKey(profileId, record.id, record.origin, record.chainId), { ...record, profileId });
            migrated++;
        } else {
            dropped++;
        }
        await apps.delete(key);
    }
    log("Legacy connected apps migrated", { migrated, dropped });
}
