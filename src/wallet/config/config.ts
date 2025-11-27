import type { BlockExplorerType } from "@/wallet/constants/explorers"

export class Config {
    // Appearance
    theme: "dark" | "light" | "system" = "dark";
    sidePanel: boolean = false;
    showNode: boolean = true;
    showPopupFullscreen: boolean = true;
    disableAnimations: boolean = false;

    // Wallet
    sessionTtl: number = 1_800_000; // 30 minutes.

    // Additional
    defaultExplorer: BlockExplorerType = "aztecscan";

    // Developer
    developerMode: boolean = false;
    debugMode: boolean = false;
    indicateFailures: boolean = false;
}

export type ConfigKey = keyof Config;

export type ConfigProp = {
    [TKey in ConfigKey]: {
        key: TKey;
        value: Config[TKey];
    };
}[ConfigKey];
