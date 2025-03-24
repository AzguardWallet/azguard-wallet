export enum FeePaymentMethodType {
    FeeJuice,
    FeeJuiceWithClaim,
    Fpc,
    Custom,
}

export interface IFeePaymentMethod {
    type: FeePaymentMethodType;
}

export class FeeJuicePaymentMethod implements IFeePaymentMethod {
    public readonly type = FeePaymentMethodType.FeeJuice;
}

export class FeeJuiceWithClaimPaymentMethod implements IFeePaymentMethod {
    public readonly type = FeePaymentMethodType.FeeJuiceWithClaim;
    public constructor(
        public readonly claimAmount: string,
        public readonly claimSecret: string,
        public readonly messageLeafIndex: string,
    ) {}
}

export class FpcPaymentMethod implements IFeePaymentMethod {
    public readonly type = FeePaymentMethodType.Fpc;
    public constructor(
        public readonly fpcId: string,
        public readonly inPublic?: boolean,
    ) {}
}

export class CustomPaymentMethod implements IFeePaymentMethod {
    public readonly type = FeePaymentMethodType.Custom;
    public constructor(
        public readonly teardownDaGas: number = 30_000,
        public readonly teardownL2Gas: number = 150_000,
    ) {}
}

export class FeeSettings {
    public constructor(
        public readonly paymentMethod: IFeePaymentMethod,
        public readonly gasPadding: number = 1.05,
    ) {}
}
