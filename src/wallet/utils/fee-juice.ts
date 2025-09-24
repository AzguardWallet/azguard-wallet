import { FEE_JUICE_ADDRESS } from "@aztec/constants";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { FeeJuiceContractArtifact } from "@aztec/noir-contracts.js/FeeJuice";
import { CallAction, IAction } from "@/wallet/services/execution/spec";

export const feeJuiceAddress = AztecAddress.fromNumber(FEE_JUICE_ADDRESS).toString();

export const feeJuiceArtifact = FeeJuiceContractArtifact;

export const feeJuiceName = "Fee Juice";

export const feeJuiceSymbol = "FJC";

export const getFeeJuiceClaimPayload = (
    to: string,
    amount: string,
    secret: string,
    messageLeafIndex: string,
): IAction[] => {
    return [new CallAction(feeJuiceAddress, "claim", [to, amount, secret, messageLeafIndex])];
};
