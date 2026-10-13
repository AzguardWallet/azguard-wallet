import { feeJuiceAddress, feeJuiceSymbol } from "@/wallet/utils/fee-juice";

/**
 * Tokens auto-added to every new account. Single source of truth for defaults.
 * Whitelist governed by PR review — adding a token is one entry here.
 * `label` is a human dictionary key only (logs / future token list UI), synced
 * to the on-chain symbol; token metadata is always resolved on-chain, never
 * overridden from this file.
 */
export type DefaultToken = { label: string; address: string };

// Added on every network — Fee Juice is a protocol constant, same address on all chains.
// pFJ is deliberately absent — seeded by TokenService.onFpcAdded alongside its FPC.
const ALL_CHAINS: DefaultToken[] = [{ label: feeJuiceSymbol, address: feeJuiceAddress }];

// Per-network extras, keyed by chainId.
// TODO: `v6-network` add the v6 testnet and mainnet tokens (cUSDC) once they are public.
const BY_CHAIN: Record<number, DefaultToken[]> = {};

export const getDefaultTokens = (chainId: number): DefaultToken[] => [...ALL_CHAINS, ...(BY_CHAIN[chainId] ?? [])];
