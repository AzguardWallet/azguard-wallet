import type { BlockExplorerType } from "@/wallet/constants/explorers"

export type StealthModeSnapshot = {
    contractRegistry: boolean;
    walletConnectEnabled: boolean;
    defaultExplorer: BlockExplorerType;
} | null;

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

    // External Services (Stealth Mode)
    stealthMode: boolean = true; // When ON, all external services are disabled
    stealthModeSnapshot: StealthModeSnapshot = null; // Saved state before stealth mode was enabled
    contractRegistry: boolean = false; // Enable external contract registry lookup
    walletConnectEnabled: boolean = false; // Enable WalletConnect dApp connections

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
