import type { Capability } from "@aztec/aztec.js/wallet"
import type { Account } from "@/wallet/services/account/spec"

/**
 * A boolean sub-permission row (e.g., "Get accounts", "Register contracts").
 * Rendered as a toggleable row with a label and optional badge.
 */
export type SubSection = {
	type: "sub"
	/** Denial key for this sub-permission (e.g., "canGet", "transactions") */
	key: string
	label: string
	/** Badge text shown next to label when active (e.g., "Any" for wildcard scopes) */
	badge?: string
}

/** Scope pattern item: a contract+function pair for simulation/transaction scope grids. */
export type ScopePatternItem = {
	contract: string
	function: string
}

/**
 * A grid of deniable items (contracts, accounts, scope patterns).
 * Denial keys are formed as `{keyPrefix}:{itemKey}` where the item key
 * is derived from the item itself based on variant (address string,
 * account address, or "contract.function" for scope patterns).
 * Discriminated on `variant` — each variant carries its own typed items array.
 */
export type GridSection =
	| { type: "grid"; variant: "address"; items: string[]; keyPrefix: string }
	| { type: "grid"; variant: "account"; items: Account[]; keyPrefix: string }
	| { type: "grid"; variant: "scope-pattern"; items: ScopePatternItem[]; keyPrefix: string }

/**
 * A static wildcard indicator ("{label}: Any" badge).
 * Used when a capability field is "*" — no items to enumerate or toggle.
 */
export type WildcardSection = {
	type: "wildcard"
	label: string
}

export type Section = SubSection | GridSection | WildcardSection

/**
 * Abstract base for capability UI models. Each subclass wraps a specific
 * Capability variant and encapsulates its per-type logic: which denial keys
 * exist, whether anything meaningful remains after denials, how to narrow
 * the capability for approval, and how to describe it as UI sections.
 *
 * Shared deny/restore/toggle behavior lives here — subclasses only implement
 * the four abstract methods.
 */
export abstract class UICapability {
	readonly capability: Capability
	readonly label: string
	selected: boolean
	denials: Set<string>

	constructor(capability: Capability, label: string) {
		this.capability = capability
		this.label = label
		this.selected = true
		this.denials = new Set()
	}

	/** Returns all denial keys for this capability's sub-permissions and items. */
	abstract getDeniableKeys(): string[]

	/**
	 * Whether the capability still grants something meaningful given current denials.
	 * Requires at least one active operation AND at least one active scope target.
	 */
	abstract isMeaningful(): boolean

	/**
	 * Builds a narrowed copy of the capability with denied items filtered out.
	 * Returns null if nothing meaningful remains (excluded from approval).
	 * Uses shallow spread (not structuredClone) because AztecAddress instances
	 * aren't structuredClone-able.
	 */
	abstract buildNarrowed(): Capability | null

	/** Returns UI section descriptors for rendering in CapabilityCard. */
	abstract getSections(): Section[]

	/** Denies a sub-permission or item. Auto-deselects when no longer meaningful. */
	deny(key: string): void {
		this.denials.add(key)
		if (this.selected && !this.isMeaningful()) {
			this.selected = false
		}
	}

	/** Restores a denied sub-permission or item. Auto-reselects when meaningful again. */
	restore(key: string): void {
		this.denials.delete(key)
		if (!this.selected && this.isMeaningful()) {
			this.selected = true
		}
	}

	/** Toggles the entire capability. Activating clears all denials; deactivating denies everything. */
	toggle(): void {
		const newSelected = !this.selected
		this.selected = newSelected

		if (newSelected) {
			this.denials.clear()
		} else {
			for (const key of this.getDeniableKeys()) {
				this.denials.add(key)
			}
		}
	}
}
