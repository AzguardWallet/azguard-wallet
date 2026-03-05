/**
 * AzguardWalletService spec — typed method definitions for the popup ↔ background
 * service channel that exposes standard Wallet interface methods.
 *
 * This service allows the popup UI to call the same Wallet methods that dApps
 * use (sendTx, simulateTx, etc.) over the existing chrome.runtime.connect
 * ServiceClient/Service RPC pattern.
 *
 * Internal-only operations (executeTransfer, executeOperations) remain on
 * ExecutionServiceClient — they don't have Wallet interface equivalents.
 */

export const AZGUARD_WALLET_SERVICE_NAME = "azguard-wallet";

export type Methods = {
    /**
     * Dispatch a standard Wallet method call through the WalletSdkDispatcher.
     *
     * @param methodName - Wallet method name (e.g. "sendTx", "simulateTx", "getChainInfo")
     * @param args - Method arguments as positional array
     * @param chainId - The chain ID for network resolution
     * @returns The result from the dispatched method
     */
    dispatch(methodName: string, args: unknown[], chainId: number): unknown;
};
