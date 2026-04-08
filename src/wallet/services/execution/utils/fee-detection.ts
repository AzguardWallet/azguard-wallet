/**
 * Detects whether an ExecutionPayload has an embedded fee payment method,
 * and classifies it as "fjwc" (FeeJuice with claim, payer === sender) or
 * "fpc" (external FPC, payer !== sender).
 *
 * Returns undefined if no embedded fee payment is detected.
 */
export function detectEmbeddedFeePayment(feePayer: unknown, from: unknown): "fjwc" | "fpc" | undefined {
	if (feePayer === undefined || feePayer === null) {
		return undefined
	}
	return String(feePayer) === String(from) ? "fjwc" : "fpc"
}

/**
 * Detects whether a sendTx opts.from value indicates a NO_FROM (DefaultEntrypoint) transaction.
 */
export function isNoFromRequest(from: unknown): boolean {
	return from === "NO_FROM"
}
