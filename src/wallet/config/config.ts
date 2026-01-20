import type { BlockExplorerType } from "@/wallet/constants/explorers"

export type ExternalLinksMode = "disabled" | "confirm" | "enabled";

export type StealthModeSnapshot = {
    contractRegistry: boolean;
    walletConnectEnabled: boolean;
    uploadExternalImages: boolean;
    externalLinks: ExternalLinksMode;
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
    defaultExplorer: BlockExplorerType | null = "aztecscan";

    // External Services (Stealth Mode)
    stealthMode: boolean = false; // When ON, all external services are disabled
    stealthModeSnapshot: StealthModeSnapshot = null; // Saved state before stealth mode was enabled
    contractRegistry: boolean = true; // Enable external contract registry lookup
    walletConnectEnabled: boolean = true; // Enable WalletConnect dApp connections
    uploadExternalImages: boolean = true; // Load images from external URLs
    externalLinks: ExternalLinksMode = "enabled"; // How to handle external link clicks

    // Developer
    developerMode: boolean = false;
    debugMode: boolean = false;
    indicateFailures: boolean = false;

    // One-time flags
    hasSeenStealthPromo: boolean = false; // Set true after first profile creation
}

export type ConfigKey = keyof Config;

export type ConfigProp = {
    [TKey in ConfigKey]: {
        key: TKey;
        value: Config[TKey];
    };
}[ConfigKey];
