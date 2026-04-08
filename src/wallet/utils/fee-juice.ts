import { FEE_JUICE_ADDRESS } from "@aztec/constants"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { FeeJuiceContractArtifact } from "@aztec/noir-contracts.js/FeeJuice"
import type { Action } from "@/wallet/services/execution/spec"

export const feeJuiceAddress = AztecAddress.fromNumber(FEE_JUICE_ADDRESS).toString()

export const feeJuiceArtifact = FeeJuiceContractArtifact

export const feeJuiceName = "Fee Juice"

export const feeJuiceSymbol = "FJC"

export const getFeeJuiceClaimPayload = (to: string, amount: string, secret: string, messageLeafIndex: string): Action[] => {
	return [
		{
			kind: "call",
			contract: feeJuiceAddress,
			method: "claim_and_end_setup",
			args: [to, amount, secret, messageLeafIndex],
		},
	]
}
