import type {
	Capability,
	ContractFunctionPattern,
	AccountsCapability,
	ContractsCapability,
	ContractClassesCapability,
	SimulationCapability,
	TransactionCapability,
	DataCapability,
} from "@aztec/aztec.js/wallet"
import { CapabilitySchema } from "@aztec/aztec.js/wallet"
import type { Account } from "@/wallet/services/account/spec"

// ── Public types ─────────────────────────────────────────────────────

/** A toggleable boolean permission within a feature (e.g., "Get accounts", "Register contracts"). */
export type Switch = { key: string; label: string; badge?: string }

/** Stringified contract + function pair for scope pattern grids. */
export type ScopePatternItem = { contract: string; function: string }

/** A static wildcard indicator — represents unrestricted access (e.g., "Contracts: Any"). */
export type Wildcard = { kind: "wildcard"; label: string }

/**
 * A grid of individually-excludable items, discriminated by variant.
 * Each variant carries its own typed items array:
 * - `"address"` — stringified contract addresses, class IDs, or event sources
 * - `"account"` — wallet Account objects (populated async via `setAccountItems`)
 * - `"scope-pattern"` — contract + function pairs for simulation/transaction scopes
 *
 * Exclusion keys are formed as `{keyPrefix}:{itemKey}` via `gridItemKey()`.
 */
export type Grid =
	| { kind: "grid"; keyPrefix: string; variant: "address"; items: string[] }
	| { kind: "grid"; keyPrefix: string; variant: "account"; items: Account[] }
	| { kind: "grid"; keyPrefix: string; variant: "scope-pattern"; items: ScopePatternItem[] }

/** Either a wildcard or a grid of items. */
export type Items = Wildcard | Grid

/**
 * The smallest independently-meaningful unit within a capability.
 * A feature is "alive" when at least one switch is active OR at least one item is active.
 * A capability is meaningful when any feature is alive (OR semantics across features).
 */
export type Feature = { switches: Switch[]; items: Items | null }

// ── Helpers ──────────────────────────────────────────────────────────

/** Converts an SDK ContractFunctionPattern (with AztecAddress) to a stringified ScopePatternItem. */
function toScopePatternItem(p: ContractFunctionPattern): ScopePatternItem {
	return { contract: String(p.contract), function: p.function }
}

/**
 * Computes the full exclusion key for a grid item at the given index.
 * Uses an exhaustive variant switch — fully type-safe, no casts.
 */
export function gridItemKey(g: Grid, index: number): string {
	switch (g.variant) {
		case "address": return `${g.keyPrefix}:${g.items[index]}`
		case "account": return `${g.keyPrefix}:${g.items[index].address}`
		case "scope-pattern": {
			const p = g.items[index]
			return `${g.keyPrefix}:${p.contract}.${p.function}`
		}
	}
}

/** A feature is alive when not all switches are excluded AND not all items are excluded. */
function isFeatureAlive(f: Feature, exclusions: Set<string>): boolean {
	if (f.switches.length > 0 && f.switches.every(s => exclusions.has(s.key)))
		return false
	if (f.items?.kind === "grid") {
		if (f.items.items.length === 0) return false
		const g = f.items
		if (g.items.every((_, i) => exclusions.has(gridItemKey(g, i))))
			return false
	}
	return true
}

// ── Capability definitions ──────────────────────────────────────────

/**
 * Defines how a raw SDK Capability is mapped to/from the UI model.
 * Generic over `T` so each definition is typed to its specific SDK capability interface.
 * - `extract`: reads the raw capability and returns normalized Features for display
 * - `reconstruct`: applies exclusions to the original capability, returning a narrowed copy
 *   (preserves SDK types like AztecAddress/Fr — no stringification)
 */
type CapabilityDef<T extends Capability> = {
	label: string
	extract: (cap: T) => Feature[]
	reconstruct: (cap: T, exclusions: Set<string>) => Capability
}

/** One feature: optional canGet/canCreateAuthWit switches + account grid (populated via setAccountItems). */
const ACCOUNTS_DEF: CapabilityDef<AccountsCapability> = {
	label: "Account access",
	extract: (cap) => [{
		switches: [
			...(cap.canGet ? [{ key: "canGet", label: "Get accounts" }] : []),
			...(cap.canCreateAuthWit ? [{ key: "canCreateAuthWit", label: "Create auth witnesses" }] : []),
		],
		items: { kind: "grid", keyPrefix: "account", variant: "account", items: [] },
	}],
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		if (exclusions.has("canGet")) r.canGet = false
		if (exclusions.has("canCreateAuthWit")) r.canCreateAuthWit = false
		return r
	},
}

/** One feature: optional canRegister/canGetMetadata switches + wildcard or contract address list. */
const CONTRACTS_DEF: CapabilityDef<ContractsCapability> = {
	label: "Contract interaction",
	extract: (cap) => [{
		switches: [
			...(cap.canRegister ? [{ key: "canRegister", label: "Register contracts" }] : []),
			...(cap.canGetMetadata ? [{ key: "canGetMetadata", label: "Get contract metadata" }] : []),
		],
		items: cap.contracts === "*"
			? { kind: "wildcard", label: "Contracts" }
			: { kind: "grid", keyPrefix: "contract", variant: "address", items: cap.contracts.map(String) },
	}],
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		if (exclusions.has("canRegister")) r.canRegister = false
		if (exclusions.has("canGetMetadata")) r.canGetMetadata = false
		if (r.contracts !== "*") {
			r.contracts = r.contracts.filter(c => !exclusions.has(`contract:${String(c)}`))
		}
		return r
	},
}

/** One feature: optional canGetMetadata switch + wildcard or class ID list. */
const CONTRACT_CLASSES_DEF: CapabilityDef<ContractClassesCapability> = {
	label: "Contract class metadata",
	extract: (cap) => [{
		switches: [
			...(cap.canGetMetadata ? [{ key: "canGetMetadata", label: "Get class metadata" }] : []),
		],
		items: cap.classes === "*"
			? { kind: "wildcard", label: "Classes" }
			: { kind: "grid", keyPrefix: "class", variant: "address", items: cap.classes.map(String) },
	}],
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		if (exclusions.has("canGetMetadata")) r.canGetMetadata = false
		if (r.classes !== "*") {
			r.classes = r.classes.filter(c => !exclusions.has(`class:${String(c)}`))
		}
		return r
	},
}

/** Extracts a Feature for a simulation sub-capability (transactions or utilities). */
function extractSimScope(
	scope: "*" | ContractFunctionPattern[],
	key: string,
	label: string,
	keyPrefix: string,
): Feature {
	return {
		switches: [{ key, label, badge: scope === "*" ? "Any" : undefined }],
		items: scope === "*" ? null
			: { kind: "grid", keyPrefix, variant: "scope-pattern", items: scope.map(toScopePatternItem) },
	}
}

/** Applies exclusions to a simulation sub-capability, returning undefined if fully excluded. */
function reconstructSimScope(
	scope: "*" | ContractFunctionPattern[],
	exclusions: Set<string>,
	switchKey: string,
	keyPrefix: string,
): { scope: "*" | ContractFunctionPattern[] } | undefined {
	if (exclusions.has(switchKey)) return undefined
	if (scope === "*") return { scope }
	const filtered = scope.filter(
		p => !exclusions.has(`${keyPrefix}:${String(p.contract)}.${p.function}`),
	)
	return filtered.length === 0 ? undefined : { scope: filtered }
}

/**
 * 0–2 features (one per sub-capability: transactions, utilities).
 * Each feature: one switch (badge "Any" if wildcard scope) + scope pattern items or null.
 */
const SIMULATION_DEF: CapabilityDef<SimulationCapability> = {
	label: "Transaction simulation",
	extract: (cap) => {
		const features: Feature[] = []
		if (cap.transactions) features.push(extractSimScope(cap.transactions.scope, "transactions", "Transaction simulation", "tx_pattern"))
		if (cap.utilities) features.push(extractSimScope(cap.utilities.scope, "utilities", "Utility simulation", "util_pattern"))
		return features
	},
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		r.transactions = cap.transactions
			? reconstructSimScope(cap.transactions.scope, exclusions, "transactions", "tx_pattern") as typeof r.transactions
			: undefined
		r.utilities = cap.utilities
			? reconstructSimScope(cap.utilities.scope, exclusions, "utilities", "util_pattern") as typeof r.utilities
			: undefined
		return r
	},
}

/** One feature: no switches, just scope pattern items or wildcard. */
const TRANSACTION_DEF: CapabilityDef<TransactionCapability> = {
	label: "Transaction execution",
	extract: (cap) => [{
		switches: [],
		items: cap.scope === "*"
			? { kind: "wildcard", label: "Scope" }
			: { kind: "grid", keyPrefix: "scope_pattern", variant: "scope-pattern",
				items: cap.scope.map(toScopePatternItem) },
	}],
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		if (r.scope !== "*") {
			r.scope = r.scope.filter(
				p => !exclusions.has(`scope_pattern:${String(p.contract)}.${p.function}`),
			)
		}
		return r
	},
}

/**
 * 0–2 independent features: addressBook (switch only) + privateEvents (switch + scope).
 * Uses OR semantics: addressBook alone is meaningful even with all events excluded.
 */
const DATA_DEF: CapabilityDef<DataCapability> = {
	label: "Data access",
	extract: (cap) => {
		const features: Feature[] = []
		if (cap.addressBook) {
			features.push({
				switches: [{ key: "addressBook", label: "Address book access" }],
				items: null,
			})
		}
		if (cap.privateEvents) {
			const contracts = cap.privateEvents.contracts
			features.push({
				switches: [{ key: "privateEvents", label: "Private events access" }],
				items: contracts === "*"
					? { kind: "wildcard", label: "Event sources" }
					: { kind: "grid", keyPrefix: "event_source", variant: "address",
						items: contracts.map(String) },
			})
		}
		return features
	},
	reconstruct: (cap, exclusions) => {
		const r = { ...cap }
		if (exclusions.has("addressBook")) r.addressBook = false
		if (exclusions.has("privateEvents")) {
			delete r.privateEvents
		} else if (r.privateEvents && r.privateEvents.contracts !== "*") {
			const filtered = r.privateEvents.contracts.filter(
				c => !exclusions.has(`event_source:${String(c)}`),
			)
			if (filtered.length === 0) delete r.privateEvents
			else r.privateEvents = { contracts: filtered }
		}
		return r
	},
}

// ── UICapability ────────────────────────────────────────────────────

/**
 * Unified UI model for a single SDK Capability.
 *
 * Wraps any Capability variant and provides:
 * - Feature-based display model (switches + typed item grids)
 * - Exclusion tracking with auto-select/deselect
 * - Narrowing: produces a filtered Capability with excluded items removed
 *
 * Pipeline:
 *   raw Capability → create() → UICapability (features, exclusions, selected)
 *                                  → narrow() → filtered Capability | null
 *
 * The raw SDK capability (containing AztecAddress/Fr) is captured in the
 * `applyExclusions` closure rather than stored as a class field, avoiding
 * vue-tsc structural expansion issues with AztecAddress's private fields.
 */
export class UICapability {
	/** Capability type discriminant (e.g., "accounts", "contracts"). */
	readonly type: Capability["type"]

	/** Human-readable label for display (e.g., "Account access"). */
	readonly label: string

	/** Extracted features for rendering — switches and typed item grids. */
	readonly features: Feature[]

	/** Whether the user has selected (approved) this capability. */
	selected: boolean

	/** Keys of excluded switches and items. */
	exclusions: Set<string>

	/**
	 * Applies exclusions to the raw capability, returning the narrowed result.
	 * Closured over the raw SDK capability + reconstruct function to avoid
	 * storing AztecAddress-bearing types on the class (vue-tsc workaround).
	 */
	readonly applyExclusions: (exclusions: Set<string>) => Capability

	constructor(
		type: Capability["type"],
		label: string,
		features: Feature[],
		applyExclusions: (exclusions: Set<string>) => Capability,
	) {
		this.type = type
		this.label = label
		this.features = features
		this.applyExclusions = applyExclusions
		this.selected = true
		this.exclusions = new Set()
	}

	/**
	 * Creates a UICapability from a raw SDK capability request.
	 * Validates with Zod schema, looks up the definition by type, then builds.
	 * Returns null for invalid capabilities (unknown type, wrong fields, malformed scope).
	 */
	static create(cap: Capability): UICapability | null {
		const parsed = CapabilitySchema.safeParse(cap)
		if (!parsed.success) return null

		const valid = parsed.data as Capability
		switch (valid.type) {
			case "accounts": return UICapability.build(valid, ACCOUNTS_DEF)
			case "contracts": return UICapability.build(valid, CONTRACTS_DEF)
			case "contractClasses": return UICapability.build(valid, CONTRACT_CLASSES_DEF)
			case "simulation": return UICapability.build(valid, SIMULATION_DEF)
			case "transaction": return UICapability.build(valid, TRANSACTION_DEF)
			case "data": return UICapability.build(valid, DATA_DEF)
			default: return null
		}
	}

	/** Builds a UICapability from a validated capability and its typed definition. */
	static build<T extends Capability>(cap: T, def: CapabilityDef<T>): UICapability {
		const applyExclusions = (exclusions: Set<string>): Capability => {
			if (exclusions.size === 0) return cap
			return def.reconstruct(cap, exclusions)
		}
		return new UICapability(cap.type, def.label, def.extract(cap), applyExclusions)
	}

	/** Whether the capability still grants something meaningful given current exclusions. */
	get alive(): boolean {
		return this.features.some(f => isFeatureAlive(f, this.exclusions))
	}

	/**
	 * Produces a narrowed copy of the capability with excluded items filtered out.
	 * Returns null if deselected or nothing meaningful remains.
	 */
	narrow(): Capability | null {
		if (!this.selected || !this.alive) return null
		return this.applyExclusions(this.exclusions)
	}

	/** Sets the account items for the accounts feature (populated async from wallet). */
	setAccountItems(items: Account[]): void {
		for (const f of this.features) {
			if (f.items?.kind === "grid" && f.items.variant === "account") {
				f.items.items = items
				return
			}
		}
	}

	/** Returns non-excluded account items (approved accounts for the session). */
	getActiveAccountItems(): Account[] {
		for (const f of this.features) {
			if (f.items?.kind === "grid" && f.items.variant === "account") {
				const g = f.items
				return g.items.filter(
					(_, i) => !this.exclusions.has(gridItemKey(g, i)),
				)
			}
		}
		return []
	}

	/** Excludes a switch or item. Auto-deselects when no longer meaningful. */
	exclude(key: string): void {
		this.exclusions.add(key)
		if (this.selected && !this.alive) {
			this.selected = false
		}
	}

	/** Re-includes an excluded switch or item. Auto-reselects when meaningful again. */
	include(key: string): void {
		this.exclusions.delete(key)
		if (!this.selected && this.alive) {
			this.selected = true
		}
	}

	/** Toggles the entire capability. Activating clears all exclusions; deactivating excludes everything. */
	toggle(): void {
		const newSelected = !this.selected
		this.selected = newSelected

		if (newSelected) {
			this.exclusions.clear()
			if (!this.alive) {
				this.selected = false
			}
		} else {
			for (const key of this.getExcludableKeys()) {
				this.exclusions.add(key)
			}
		}
	}

	/** Returns all excludable keys for this capability's switches and grid items. */
	getExcludableKeys(): string[] {
		const keys: string[] = []
		for (const f of this.features) {
			for (const s of f.switches) keys.push(s.key)
			if (f.items?.kind === "grid") {
				const g = f.items
				for (let i = 0; i < g.items.length; i++) {
					keys.push(gridItemKey(g, i))
				}
			}
		}
		return keys
	}
}
