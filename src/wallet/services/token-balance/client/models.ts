import { TokenInfo } from "@/wallet/services/token/client";

export class TokenBalanceInfo {
    constructor(
        public readonly id: number,
        public readonly token: TokenInfo,
        public readonly account: string,
        public publicBalance: string | undefined,
        public privateBalance: string | undefined,
        public updatedAt: number,
    ) {}
}