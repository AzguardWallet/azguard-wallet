/**
 * AzguardWalletServiceClient — Popup-side client for calling standard Wallet
 * methods through the WalletSdkDispatcher.
 *
 * Usage in popup components:
 * ```typescript
 * const wallet = new AzguardWalletServiceClient();
 * wallet.connect();
 *
 * // Call any standard Wallet method:
 * const chainInfo = await wallet.dispatch("getChainInfo", [], chainId);
 * const result = await wallet.dispatch("simulateUtility", [call, opts], chainId);
 *
 * wallet.disconnect();
 * ```
 */

import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { AZGUARD_WALLET_SERVICE_NAME, type Methods } from "./spec";

export class AzguardWalletServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(name?: string) {
        super(AZGUARD_WALLET_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public dispatch(methodName: string, args: unknown[], chainId: number): Promise<unknown> {
        return this.request("dispatch", methodName, args, chainId);
    }
}
