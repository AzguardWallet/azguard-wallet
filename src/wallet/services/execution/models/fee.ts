export type FeePaymentMethod =
    | FeeJuicePaymentMethod
    | FeeJuiceWithClaimPaymentMethod
    | FpcPaymentMethod
    | CustomPaymentMethod;

export type FeeJuicePaymentMethod = {
    readonly kind: "fj";
};

export type FeeJuiceWithClaimPaymentMethod = {
    readonly kind: "fjwc";
    readonly claimAmount: string;
    readonly claimSecret: string;
    readonly messageLeafIndex: string;
};

export type FpcPaymentMethod = {
    readonly kind: "fpc";
    readonly fpcId: string;
    readonly inPublic?: boolean;
};

export type CustomPaymentMethod = {
    readonly kind: "embedded";
};

export type PriorityLevel = "normal" | "fast" | "urgent";

export const PRIORITY_MULTIPLIERS: Record<PriorityLevel, number> = {
    normal: 2,
    fast: 3,
    urgent: 5,
};

export type FeeSettings = {
    readonly paymentMethod: FeePaymentMethod;
    readonly priorityLevel?: PriorityLevel;
};

export type GasBalances = {
    /** Public FeeJuice balance (raw, 18 decimals) */
    readonly publicFeeJuice: string;
    /** Private FeeJuice balance via PrivateFPC (raw, 18 decimals), null if no PrivateFPC */
    readonly privateFeeJuice: string | null;
};

export type TransferFeeEstimate = {
    /** Raw max fee as string (bigint serialized) */
    readonly maxFee: string;
    /** Human-readable fee amount, e.g. "0.000123" */
    readonly maxFeeFormatted: string;
    /** USD value, e.g. "$0.003" */
    readonly maxFeeUsd: string;
    /** Gas breakdown */
    readonly gasDetails: {
        l2GasLimit: number;
        daGasLimit: number;
        teardownL2GasLimit: number;
        teardownDaGasLimit: number;
        feePerL2Gas: string;
        feePerDaGas: string;
    };
};
