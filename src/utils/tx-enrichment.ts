import { OriginType } from "@/wallet/services/transaction/spec"
import type { TxOrigin } from "@/wallet/services/transaction/spec"
import { trimAddress } from "@/utils/string"

type TxCall = {
	contract: string
	method: string
	args?: any[]
}

const METHOD_LABELS: Record<string, string> = {
	transfer: "Transfer (private)",
	transfer_in_private: "Transfer (private)",
	transfer_in_public: "Transfer (public)",
	transfer_to_private: "Transfer to private",
	transfer_to_public: "Transfer to public",
	// Wonderland standard function names
	transfer_private_to_private: "Transfer (private)",
	transfer_public_to_public: "Transfer (public)",
	transfer_private_to_public: "Transfer (private → public)",
	transfer_public_to_private: "Transfer (public → private)",
	mint_to_public: "Mint (public)",
	mint_to_private: "Mint (private)",
	shield: "Shield",
	unshield: "Unshield",
	redeem_shield: "Redeem shield",
}

/** Fee/entrypoint methods injected by the wallet — not the user's intent. */
const FEE_METHODS = new Set(["sponsor_unconditionally", "fee_entrypoint_private", "fee_entrypoint_public", "set_authorized"])

/**
 * Maps a method name/selector to a human-readable label.
 * - Known Aztec methods get friendly labels
 * - Hex selectors get truncated
 * - Generic snake_case gets title-cased
 */
export function humanizeMethodName(method: string): string {
	if (!method) return "Unknown"

	const label = METHOD_LABELS[method]
	if (label) return label

	// Hex selector — truncate
	if (/^0x[0-9a-fA-F]+$/.test(method)) {
		return method.length > 10 ? `${method.slice(0, 10)}...` : method
	}

	// Generic snake_case → title case
	return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Finds the user's primary call, skipping fee/entrypoint infrastructure calls.
 */
export function getPrimaryCall(calls: TxCall[]): TxCall | undefined {
	const userCalls = calls.filter((c) => !FEE_METHODS.has(c.method))
	// Preserve existing mint heuristic: if second user call is a mint, prefer it
	if (userCalls.at(1)?.method?.startsWith("mint")) return userCalls[1]
	return userCalls[0] ?? calls[0]
}

/**
 * Categorizes a transaction by its calls.
 */
export function getTxCategory(calls: TxCall[]): "transfer" | "mint" | "tx" {
	const call = getPrimaryCall(calls)
	if (call?.method?.startsWith("transfer")) return "transfer"
	if (call?.method?.startsWith("mint_to_")) return "mint"
	return "tx"
}

/**
 * Returns a display title for a transaction.
 * - Transfer/mint get existing labels
 * - Generic txs get humanized primary method name
 */
export function getTxTitle(calls: TxCall[]): string {
	const category = getTxCategory(calls)
	if (category === "transfer") return "Transfer"
	if (category === "mint") return "Mint"

	const primary = getPrimaryCall(calls)
	return primary ? humanizeMethodName(primary.method) : "Transaction"
}

/**
 * Returns "N calls" label for multi-call transactions, null for single.
 * Excludes fee/entrypoint infrastructure calls from the count.
 */
export function getCallCountLabel(calls: TxCall[]): string | null {
	if (!calls) return null
	const userCalls = calls.filter((c) => !FEE_METHODS.has(c.method))
	if (userCalls.length <= 1) return null
	return `${userCalls.length} calls`
}

/**
 * Returns dApp name for DAPP origin, null for UI/other.
 */
export function getOriginLabel(origin?: TxOrigin): string | null {
	if (!origin || origin.type !== OriginType.DAPP) return null
	return origin.name || "dApp"
}

/**
 * Formats a call for compact display: "Method on 0x1234..ab"
 */
export function formatCallSummary(method: string, contract: string): string {
	return `${humanizeMethodName(method)} on ${trimAddress(contract, 6, 4)}`
}

// TransferType enum values: Private=0, PrivateToPublic=1, Public=2, PublicToPrivate=3
const TRANSFER_TYPE_LABELS: Record<number | string, string> = {
	0: "Private → Private",
	1: "Private → Public",
	2: "Public → Public",
	3: "Public → Private",
	Private: "Private → Private",
	PrivateToPublic: "Private → Public",
	Public: "Public → Public",
	PublicToPrivate: "Public → Private",
}

/**
 * Returns a human-readable transfer type label.
 */
export function formatTransferType(type: number | string): string {
	return TRANSFER_TYPE_LABELS[type] ?? String(type)
}
