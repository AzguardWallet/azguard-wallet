import type { ContractsCapability, Capability } from "@aztec/aztec.js/wallet"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

export class ContractsUICapability extends UICapability {
	constructor(capability: ContractsCapability) {
		super(capability, "Contract interaction")
	}

	get cap(): ContractsCapability {
		return this.capability as ContractsCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.canRegister) keys.push("canRegister")
		if (this.cap.canGetMetadata) keys.push("canGetMetadata")
		if (this.cap.contracts !== "*") {
			for (const c of this.cap.contracts) keys.push(`contract:${String(c)}`)
		}
		return keys
	}

	isMeaningful(): boolean {
		const c = this.cap
		const d = this.denials
		const hasSub = (c.canRegister && !d.has("canRegister")) || (c.canGetMetadata && !d.has("canGetMetadata"))
		if (!hasSub) return false
		return c.contracts === "*" || c.contracts.some(c => !d.has(`contract:${String(c)}`))
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability
		const cap = { ...this.cap }
		if (this.denials.has("canRegister")) cap.canRegister = false
		if (this.denials.has("canGetMetadata")) cap.canGetMetadata = false
		if (cap.contracts !== "*") {
			cap.contracts = cap.contracts.filter(c => !this.denials.has(`contract:${String(c)}`))
			if (cap.contracts.length === 0 && !cap.canRegister && !cap.canGetMetadata) return null
		}
		if (!cap.canRegister && !cap.canGetMetadata) return null
		return cap
	}

	getSections(): Section[] {
		const c = this.cap
		const s: Section[] = []
		if (c.canRegister) s.push({ type: "sub", key: "canRegister", label: "Register contracts" })
		if (c.canGetMetadata) s.push({ type: "sub", key: "canGetMetadata", label: "Get contract metadata" })
		if (c.contracts === "*") {
			s.push({ type: "wildcard", label: "Contracts" })
		} else {
			const items = c.contracts.map(c => String(c))
			s.push({ type: "grid", items, keyPrefix: "contract", variant: "address" })
		}
		return s
	}
}
