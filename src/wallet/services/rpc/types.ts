export const AzguardWalletInfo: WalletInfo = {
    name: "Azguard",
    description: "The wallet of your dream",
    logo: chrome.runtime.getURL("/src/assets/logo.png"),
    url: "https://azguardwallet.io",
    version: "1.0.0",
    capabilities: [
        "batch_execution",
    ],
};

export type WalletInfo = {
    name: string,
    description: string,
    logo: string,
    url: string,
    version: string,
    capabilities: string[],
};

export enum RpcMethod {
    get_wallet_info = "get_wallet_info",
    get_session = "get_session",
    close_session = "close_session",
    connect = "connect",
    execute = "execute",
};

export enum RpcEvent {
    session_updated = "session_updated",
    session_closed = "session_closed",
};