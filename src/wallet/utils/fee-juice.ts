import { FEE_JUICE_ADDRESS } from "@aztec/constants";
import { Fr } from "@aztec/foundation/curves/bn254";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { deriveStorageSlotInMap } from "@aztec/stdlib/hash";
import { AztecNode } from "@aztec/stdlib/interfaces/client";
import { Action } from "@/wallet/services/execution/spec";

export const feeJuiceAddress = AztecAddress.fromNumber(FEE_JUICE_ADDRESS).toString();
export const feeJuiceDecimals = 18;

const FEE_JUICE_BALANCES_SLOT = new Fr(1);

export async function getFeeJuiceBalance(node: AztecNode, owner: string): Promise<bigint> {
    const slot = await deriveStorageSlotInMap(FEE_JUICE_BALANCES_SLOT, AztecAddress.fromString(owner));
    const balance = await node.getPublicStorageAt("latest", AztecAddress.fromNumber(FEE_JUICE_ADDRESS), slot);
    return balance.toBigInt();
}

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
