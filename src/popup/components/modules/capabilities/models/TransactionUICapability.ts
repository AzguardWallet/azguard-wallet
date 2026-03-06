import type { TransactionCapability, Capability, ContractFunctionPattern } from "@aztec/aztec.js/wallet"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

/** Builds a stable string key from a scope pattern: "contract.function" */
const scopeKey = (p: ContractFunctionPattern) => `${String(p.contract)}.${p.function}`

export class TransactionUICapability extends UICapability {
	constructor(capability: TransactionCapability) {
		super(capability, "Transaction execution")
	}

	get cap(): TransactionCapability {
		return this.capability as TransactionCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.scope !== "*") {
			for (const p of this.cap.scope) keys.push(`scope_pattern:${scopeKey(p)}`)
		}
		return keys
	}

	isMeaningful(): boolean {
		return this.cap.scope === "*" || this.cap.scope.some(p => !this.denials.has(`scope_pattern:${scopeKey(p)}`))
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability
		const cap = { ...this.cap }
		if (cap.scope !== "*") {
			cap.scope = cap.scope.filter(p => !this.denials.has(`scope_pattern:${scopeKey(p)}`))
			if (cap.scope.length === 0) return null
		}
		return cap
	}

	getSections(): Section[] {
		if (this.cap.scope === "*") {
			return [{ type: "wildcard", label: "Scope" }]
		}
		const items = this.cap.scope.map(p => ({ contract: String(p.contract), function: p.function }))
		return [{ type: "grid", items, keyPrefix: "scope_pattern", variant: "scope-pattern" }]
	}
}
