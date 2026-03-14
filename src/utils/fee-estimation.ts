import BigNumber from "bignumber.js";

/** FeeJuice has 18 decimals */
const FEE_JUICE_DECIMALS = 18;

/** Default FeeJuice pricing — hardcoded for privacy (no external API) */
export const FEE_JUICE_USD_RATE = 0.02;

export type AssetPricing = {
    address: string;
    usdRate: number;
    symbol: string;
    decimals: number;
};

export const FEE_JUICE_PRICING: AssetPricing = {
    address: "0x0000000000000000000000000000000000000000000000000000000000000005",
    usdRate: FEE_JUICE_USD_RATE,
    symbol: "FJ",
    decimals: FEE_JUICE_DECIMALS,
};

/** Compute max fee from gas limits and fees per gas */
export function computeMaxFee(
    gasLimits: { daGas: number; l2Gas: number },
    teardownLimits: { daGas: number; l2Gas: number },
    maxFeesPerGas: { feePerDaGas: bigint; feePerL2Gas: bigint },
): bigint {
    const totalDaGas = BigInt(gasLimits.daGas + teardownLimits.daGas);
    const totalL2Gas = BigInt(gasLimits.l2Gas + teardownLimits.l2Gas);
    return totalDaGas * maxFeesPerGas.feePerDaGas + totalL2Gas * maxFeesPerGas.feePerL2Gas;
}

/** Format a raw fee amount (18 decimals) to human-readable string */
export function formatFeeJuice(amount: bigint, maxDecimals: number = 6): string {
    const bn = new BigNumber(amount.toString()).div(new BigNumber(`1${"0".repeat(FEE_JUICE_DECIMALS)}`));
    if (bn.isZero()) return "0";
    // Show up to maxDecimals significant decimal places
    const formatted = bn.toFixed(maxDecimals);
    // Trim trailing zeros but keep at least one decimal if non-zero
    return formatted.replace(/\.?0+$/, "") || "0";
}

/** Compute USD value from raw fee amount and asset pricing */
export function feeToUsd(feeAmount: bigint, pricing: AssetPricing = FEE_JUICE_PRICING): string {
    const bn = new BigNumber(feeAmount.toString())
        .div(new BigNumber(`1${"0".repeat(pricing.decimals)}`))
        .times(pricing.usdRate);
    if (bn.isLessThan(0.001) && !bn.isZero()) {
        return "<$0.001";
    }
    return `$${bn.toFixed(3)}`;
}

/** Format a gas amount with thousands separators */
export function formatGas(gas: number): string {
    return gas.toLocaleString("en-US");
}

export type FeeEstimate = {
    gasUsed: { daGas: number; l2Gas: number };
    maxFee: bigint;
    maxFeeFormatted: string;
    maxFeeUsd: string;
};

/** Build a FeeEstimate from raw gas data */
export function buildFeeEstimate(
    daGas: number,
    l2Gas: number,
    feePerDaGas: bigint,
    feePerL2Gas: bigint,
): FeeEstimate {
    const maxFee = BigInt(daGas) * feePerDaGas + BigInt(l2Gas) * feePerL2Gas;
    return {
        gasUsed: { daGas, l2Gas },
        maxFee,
        maxFeeFormatted: formatFeeJuice(maxFee),
        maxFeeUsd: feeToUsd(maxFee),
    };
}
