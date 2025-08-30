export const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

export type Methods = {
    /**
     * Calls for pairing in the WalletConnect network.
     * @param uri WalletConnect connection uri.
     */
    connectByURI(uri: string): void;
};
