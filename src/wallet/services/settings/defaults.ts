import type { SettingValue } from "./client";

export const DEFAULT_SETTINGS: Record<string, Record<string, SettingValue>> = {
    appearance: {
        theme: "dark",
        sidePanel: false,
		showNode: true,
		showPopupFullscreen: false,
		disableAnimations: false,
    },
    session: {
        ttl: 1_800_000, // 30 minutes.
    },
    developer: {
        developerMode: false,
        debugMode: false,
        indicateFailures: false,
    },
};

export const DEFAULT_SETTING_GROUPS: Record<string, string> = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).flatMap(([group, entries]) =>
        Object.keys(entries).map((key) => [key, group])
    )
);
