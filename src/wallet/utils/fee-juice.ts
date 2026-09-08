import { FEE_JUICE_ADDRESS } from "@aztec/constants";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Action } from "@/wallet/services/execution/spec";

export const feeJuiceAddress = AztecAddress.fromNumberUnsafe(FEE_JUICE_ADDRESS).toString();

export const feeJuiceName = "Fee Juice";

export const feeJuiceSymbol = "FJ";

export const getFeeJuiceClaimPayload = (
    to: string,
    amount: string,
    secret: string,
    messageLeafIndex: string,
): Action[] => {
    return [
        {
            kind: "call",
            contract: feeJuiceAddress,
            method: "claim_and_end_setup",
            args: [to, amount, secret, messageLeafIndex],
        },
    ];
};
