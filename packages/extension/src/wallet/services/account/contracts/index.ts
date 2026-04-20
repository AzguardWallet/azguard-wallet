import type { Fr } from "@aztec/foundation/curves/bn254"
import type { AuthWitness } from "@aztec/stdlib/auth-witness"
import type { AztecAddress } from "@aztec/stdlib/aztec-address"
import type { CompleteAddress } from "@aztec/stdlib/contract"
import type { AztecNode } from "@aztec/stdlib/interfaces/client"
import type { ExecutionPayload, TxExecutionRequest } from "@aztec/stdlib/tx"
import type { DefaultAccountEntrypointOptions } from "@aztec/entrypoints/account"
import { AccountFeePaymentMethodOptions } from "@aztec/entrypoints/account"
import type { IPXE } from "@/wallet/services/pxe/client"

export * from "./nulo-account"

/**
 * Re-export upstream `AccountFeePaymentMethodOptions` under the Nulo brand for call-site clarity.
 * Values are bytecode-observable (embedded in signed payload): EXTERNAL=0, PREEXISTING_FEE_JUICE=1, FEE_JUICE_WITH_CLAIM=2.
 */
export const NuloFeePaymentMethod = {
	External: AccountFeePaymentMethodOptions.EXTERNAL,
	FeeJuice: AccountFeePaymentMethodOptions.PREEXISTING_FEE_JUICE,
	FeeJuiceWithClaim: AccountFeePaymentMethodOptions.FEE_JUICE_WITH_CLAIM,
} as const
export type NuloFeePaymentMethod = AccountFeePaymentMethodOptions

export interface IAccountContract {
	readonly address: AztecAddress

	ensureRegistered(pxe: IPXE): Promise<void>

	ensureContractRegistered(pxe: IPXE): Promise<void>

	getCompleteAddress(): Promise<CompleteAddress>

	createAuthWit(messageHash: Fr): Promise<AuthWitness>

	buildTxExecutionRequest(
		node: AztecNode,
		pxe: IPXE,
		payload: ExecutionPayload,
		options: DefaultAccountEntrypointOptions,
	): Promise<TxExecutionRequest>
}
