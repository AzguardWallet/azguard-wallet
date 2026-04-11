pub struct FeePaymentMethodEnum {
    pub EXTERNAL: u8,
    pub FEE_JUICE: u8,
    pub FEE_JUICE_WITH_CLAIM: u8,
}

pub global FeePaymentMethod: FeePaymentMethodEnum = FeePaymentMethodEnum {
    EXTERNAL: 0,
    FEE_JUICE: 1,
    FEE_JUICE_WITH_CLAIM: 2,
};

