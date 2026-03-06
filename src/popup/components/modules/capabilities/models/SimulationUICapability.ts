import type { SimulationCapability, Capability, ContractFunctionPattern } from "@aztec/aztec.js/wallet"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

/** Builds a stable string key from a scope pattern: "contract.function" */
const scopeKey = (p: ContractFunctionPattern) => `${String(p.contract)}.${p.function}`

export class SimulationUICapability extends UICapability {
	constructor(capability: SimulationCapability) {
		super(capability, "Transaction simulation")
	}

	get cap(): SimulationCapability {
		return this.capability as SimulationCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.transactions) {
			keys.push("transactions")
			if (this.cap.transactions.scope !== "*") {
				for (const p of this.cap.transactions.scope) keys.push(`tx_pattern:${scopeKey(p)}`)
			}
		}
		if (this.cap.utilities) {
			keys.push("utilities")
			if (this.cap.utilities.scope !== "*") {
				for (const p of this.cap.utilities.scope) keys.push(`util_pattern:${scopeKey(p)}`)
			}
		}
		return keys
	}

	isMeaningful(): boolean {
		const c = this.cap
		const d = this.denials

		const txOk = c.transactions
			&& !d.has("transactions")
			&& (c.transactions.scope === "*" || c.transactions.scope.some(p => !d.has(`tx_pattern:${scopeKey(p)}`)))

		const utilOk = c.utilities
			&& !d.has("utilities")
			&& (c.utilities.scope === "*" || c.utilities.scope.some(p => !d.has(`util_pattern:${scopeKey(p)}`)))

		return !!(txOk || utilOk)
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability

		const cap: SimulationCapability = { ...this.cap }

		if (this.denials.has("transactions")) {
			delete cap.transactions
		} else if (cap.transactions && cap.transactions.scope !== "*") {
			const filtered = cap.transactions.scope.filter(p => !this.denials.has(`tx_pattern:${scopeKey(p)}`))
			if (filtered.length === 0) {
				delete cap.transactions
			} else {
				cap.transactions = { scope: filtered }
			}
		}

		if (this.denials.has("utilities")) {
			delete cap.utilities
		} else if (cap.utilities && cap.utilities.scope !== "*") {
			const filtered = cap.utilities.scope.filter(p => !this.denials.has(`util_pattern:${scopeKey(p)}`))
			if (filtered.length === 0) {
				delete cap.utilities
			} else {
				cap.utilities = { scope: filtered }
			}
		}

		if (!cap.transactions && !cap.utilities) return null
		return cap
	}

	getSections(): Section[] {
		const s: Section[] = []

		if (this.cap.transactions) {
			const scope = this.cap.transactions.scope
			s.push({
				type: "sub", key: "transactions", label: "Transaction simulation",
				badge: scope === "*" ? "Any" : undefined,
			})
			if (scope !== "*") {
				const items = scope.map(p => ({ contract: String(p.contract), function: p.function }))
				s.push({ type: "grid", keyPrefix: "tx_pattern", variant: "scope-pattern", items })
			}
		}

		if (this.cap.utilities) {
			const scope = this.cap.utilities.scope
			s.push({
				type: "sub", key: "utilities", label: "Utility simulation",
				badge: scope === "*" ? "Any" : undefined,
			})
			if (scope !== "*") {
				const items = scope.map(p => ({ contract: String(p.contract), function: p.function }))
				s.push({ type: "grid", keyPrefix: "util_pattern", variant: "scope-pattern", items })
			}
		}

		return s
	}
}
