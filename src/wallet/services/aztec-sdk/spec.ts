export const AZTEC_SDK_SERVICE_NAME = "aztec-sdk";

/** Raw storage root of the SDK connected-apps table. */
export const CONNECTED_APPS_STORAGE_ROOT = "azguard:core:aztecSdkConnectedApps";

/** The one key format of the connected-apps table — shared with the legacy migration. */
export function getConnectedAppKey(profileId: string, appId: string, origin: string, chainId: number): string {
    return JSON.stringify([profileId, appId, origin, chainId]);
}

export type Methods = {};

export type Events = {};
