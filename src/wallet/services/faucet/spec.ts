import { FeeSettings } from "@/wallet/services/execution/spec";

export const FAUCET_SERVICE_NAME = "faucet";

export type Methods = {
    /**
     * Deploys token contract and mints tokens to the specified account.
     * @param networkId Network id.
     * @param accountAddress Account address.
     * @param name Token name.
     * @param symbol Token symbol.
     * @param decimals Token decimals.
     * @param amount Amount to mint.
     * @param feeSettings Fee settings.
     */
    mint(
        networkId: string,
        accountAddress: string,
        name: string,
        symbol: string,
        decimals: number,
        amount: string,
        feeSettings: FeeSettings,
    ): void;
};
