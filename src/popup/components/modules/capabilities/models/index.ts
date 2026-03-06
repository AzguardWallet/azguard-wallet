import type { Capability } from "@aztec/aztec.js/wallet"
import { CapabilitySchema } from "@aztec/aztec.js/wallet"
import { UICapability } from "./UICapability"
import { AccountsUICapability } from "./AccountsUICapability"
import { ContractsUICapability } from "./ContractsUICapability"
import { ContractClassesUICapability } from "./ContractClassesUICapability"
import { SimulationUICapability } from "./SimulationUICapability"
import { TransactionUICapability } from "./TransactionUICapability"
import { DataUICapability } from "./DataUICapability"

export { UICapability } from "./UICapability"
export { AccountsUICapability } from "./AccountsUICapability"
export type { Section, SubSection, GridSection, WildcardSection, ScopePatternItem } from "./UICapability"

/**
 * Creates a UICapability from a raw capability request.
 * Returns null for capabilities that fail Zod schema validation
 * (unknown types, wrong field types, malformed scope data).
 */
export function createUICapability(cap: Capability): UICapability | null {
	const parsed = CapabilitySchema.safeParse(cap)
	if (!parsed.success) return null

	const valid = parsed.data as Capability
	switch (valid.type) {
		case "accounts": return new AccountsUICapability(valid)
		case "contracts": return new ContractsUICapability(valid)
		case "contractClasses": return new ContractClassesUICapability(valid)
		case "simulation": return new SimulationUICapability(valid)
		case "transaction": return new TransactionUICapability(valid)
		case "data": return new DataUICapability(valid)
	}
}
