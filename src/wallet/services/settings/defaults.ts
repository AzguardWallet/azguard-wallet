import type { SettingValue } from "./client";

export const DEFAULT_SETTINGS: Record<string, SettingValue> = {
    // Appearance
    theme: "dark",
    sidePanel: false,
    showNode: true,
    showPopupFullscreen: false,
    disableAnimations: false,

    // Wallet
    sessionTtl: 1_800_000, // 30 minutes.

    // Developer
    developerMode: false,
    debugMode: false,
    indicateFailures: false,
};
