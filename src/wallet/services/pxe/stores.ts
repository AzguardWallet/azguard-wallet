import { deleteStore, listStores, type AztecSQLiteOPFSStore } from "@aztec/kv-store/sqlite-opfs";
import { openBrowserStore, PXE_DATA_SCHEMA_VERSION } from "@aztec/pxe/client/bundle";
import { type AztecNode } from "@/wallet/utils/aztec-node-client";

// All PXE store naming lives here. Physical name:
//   pxe_data_<profileId>_<l1ChainId>-<rollupAddress>-v<schemaVersion>
// (openBrowserStore appends everything after the profile id). The profile id is in the name so
// profiles never share a store, and so a profile's stores can be found for deletion.

const PREFIX = "pxe_data_";
const storePrefix = (profileId: string) => `${PREFIX}${profileId}`;

/** Opens the profile's store for the node's network. */
export async function openPxeStore(node: AztecNode, profileId: string): Promise<AztecSQLiteOPFSStore> {
    const { l1ChainId, l1ContractAddresses } = await node.getNodeInfo();
    return openBrowserStore(storePrefix(profileId), PXE_DATA_SCHEMA_VERSION, {
        l1ChainId,
        rollupAddress: l1ContractAddresses.rollupAddress,
    });
}

/**
 * Deletes all of the profile's stores — every network and schema version. Stores must be closed.
 * Returns the deleted names.
 */
export async function deletePxeStores(profileId: string): Promise<string[]> {
    const names = (await listStores()).filter(x => x.startsWith(`${storePrefix(profileId)}_`));
    for (const name of names) {
        await deleteStore(name);
    }
    return names;
}

/**
 * Deletes every store no profile can open: stores without a profile segment in the name and
 * stores of profiles missing from `profileIds`. Stores must be closed. Returns the deleted names.
 * Not called yet — see the TODO at PxeService.init().
 */
export async function deleteOrphanPxeStores(profileIds: string[]): Promise<string[]> {
    const deleted: string[] = [];
    for (const name of await listStores()) {
        if (!name.startsWith(PREFIX)) {
            continue;
        }
        // pxe_data_<l1ChainId>-…: no profile segment in the name, nothing can open such stores
        const legacy = !name.slice(PREFIX.length).includes("_");
        // the owning profile is gone; an empty profile list deletes nothing — it is
        // indistinguishable from getProfiles() having failed
        const abandoned = profileIds.length > 0 && !profileIds.some(id => name.startsWith(`${storePrefix(id)}_`));
        if (legacy || abandoned) {
            await deleteStore(name);
            deleted.push(name);
        }
    }
    return deleted;
}
