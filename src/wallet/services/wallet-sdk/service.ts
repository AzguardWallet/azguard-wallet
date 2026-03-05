/**
 * AzguardWalletService — Background service exposing Wallet methods to the popup.
 *
 * This service bridges the popup UI to the WalletSdkDispatcher, allowing the
 * popup to call standard Wallet interface methods (sendTx, simulateTx, etc.)
 * over the existing chrome.runtime.connect ServiceClient/Service RPC pattern.
 *
 * The popup sends `dispatch(methodName, args, chainId)` and this service:
 * 1. Gets the active profile
 * 2. Builds a SessionContext from the profile + chainId
 * 3. Delegates to WalletSdkDispatcher.dispatch()
 */

import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { ProfileService } from "@/wallet/services/profile/service";
import { NetworkService } from "@/wallet/services/network/service";
import { AccountService } from "@/wallet/services/account/service";
import { ExecutionService } from "@/wallet/services/execution/service";
import { WalletSdkDispatcher } from "./dispatcher";
import type { SessionContext } from "./types";
import { AZGUARD_WALLET_SERVICE_NAME, type Methods } from "./spec";

export class AzguardWalletService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = AZGUARD_WALLET_SERVICE_NAME;

    private profileService: ProfileService = null!;
    private dispatcher: WalletSdkDispatcher = null!;

    public constructor(logger: ILogger) {
        super(AZGUARD_WALLET_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);

        const networkService: NetworkService = services.get(NetworkService.name);
        const accountService: AccountService = services.get(AccountService.name);
        const executionService: ExecutionService = services.get(ExecutionService.name);

        this.dispatcher = new WalletSdkDispatcher(networkService, accountService, executionService, this.profileService);
    }

    public async dispatch(methodName: string, args: unknown[], chainId: number): Promise<unknown> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet is locked");
        }

        const ctx: SessionContext = {
            chainId,
            profileId: profile.id,
            origin: "popup",
            sessionId: "popup",
        };

        return this.dispatcher.dispatch(methodName, args, ctx);
    }
}
