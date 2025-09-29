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
    readonly kind: "custom";
    readonly teardownDaGas?: number;
    readonly teardownL2Gas?: number;
};

export type FeeSettings = {
    readonly paymentMethod: FeePaymentMethod;
    readonly gasPadding?: number;
    // TODO: add priority fee
};
