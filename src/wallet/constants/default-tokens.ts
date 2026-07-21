import { feeJuiceAddress, feeJuiceSymbol } from "@/wallet/utils/fee-juice";
import {
    CANONICAL_PRIVATE_FPC_ADDRESS,
    privateFpcTokenSymbol,
} from "@/wallet/services/fpc/handlers/private-fpc-handler";

/**
 * Tokens auto-added to every new account. Single source of truth for defaults.
 * Whitelist governed by PR review — adding a token is one entry here.
 * `label` is a human dictionary key only (logs / future token list UI), synced
 * to the on-chain symbol; token metadata is always resolved on-chain, never
 * overridden from this file.
 */
export type DefaultToken = { label: string; address: string };

// Added on every network — Fee Juice is a protocol constant, same address on all chains;
// the canonical PrivateFPC charges in itself (pFJ) and its salt-0 address is chain-independent.
// NOTE: auto-add succeeds only when the contract is resolvable at account-creation time —
// for pFJ that means FPC discovery already registered it; the onFpcAdded hook in TokenService
// covers accounts that exist before discovery runs.
const ALL_CHAINS: DefaultToken[] = [
    { label: feeJuiceSymbol, address: feeJuiceAddress },
    { label: privateFpcTokenSymbol, address: CANONICAL_PRIVATE_FPC_ADDRESS },
];

// Per-network extras, keyed by chainId.
const BY_CHAIN: Record<number, DefaultToken[]> = {
    // Testnet
    1816023401: [
        { label: "cUSDC", address: "0x11a748929f8534259b531f742a0c60e067def53aa6cfe7952a6ce7e9ef1f511f" },
    ],
    // Alphanet (mainnet infra)
    4248422646: [
        { label: "cUSDC", address: "0x018d47f656a0d242e28e5d15b5c965f39529bd860f2eaae947527b5094d800f6" },
    ],
};

export const getDefaultTokens = (chainId: number): DefaultToken[] => [...ALL_CHAINS, ...(BY_CHAIN[chainId] ?? [])];
