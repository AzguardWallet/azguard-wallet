import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { FeeSettings } from "@/wallet/services/execution/service";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { FAUCET_SERVICE_NAME, Methods } from "./spec";

export * from "./spec";

export class FaucetServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(name?: string) {
        super(FAUCET_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public mint(
        networkId: string,
        accountAddress: string,
        name: string,
        symbol: string,
        decimals: number,
        amount: string,
        feeSettings: FeeSettings,
    ): Promise<void> {
        return this.request("mint", networkId, accountAddress, name, symbol, decimals, amount, feeSettings);
    }
}
