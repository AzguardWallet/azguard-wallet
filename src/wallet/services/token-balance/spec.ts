import { TokenInfo } from "@/wallet/services/token/spec";

export const TOKEN_BALANCE_SERVICE_NAME = "token-balance";

export type TokenBalanceRaw = {
    id: number;
    token: number;
    account: string;
    publicBalance?: string;
    privateBalance?: string;
    updatedAt: number;
};

export type TokenBalanceInfo = {
    id: number;
    token: TokenInfo;
    account: string;
    publicBalance?: string;
    privateBalance?: string;
    updatedAt: number;
};

export type Methods = {
    /**
     * Returns a token balance with the specified id.
     * @param id Token balance id.
     */
    getTokenBalance(id: number): TokenBalanceInfo;

    /**
     * Returns a list of token balances.
     * @param tokenId Token id.
     * @param accountAddress Account address.
     */
    getTokenBalances(tokenId?: number, accountAddress?: string): TokenBalanceInfo[];

    /**
     * Enqueues the token balance for immediate syncing.
     * @param id Token balance id.
     */
    refreshTokenBalance(id: number): void;

    /**
     * Returns the Fee Juice balance for an account.
     * Fee Juice is a protocol contract, so we read its balance directly from public storage.
     * @param networkId Network id.
     * @param accountAddress Account address.
     */
    getFeeJuiceBalance(networkId: string, accountAddress: string): string;
};

export type Events = {
    onTokenBalanceAdded: TokenBalanceInfo;
    onTokenBalanceUpdated: TokenBalanceInfo;
    onTokenBalanceDeleted: TokenBalanceInfo;
};
