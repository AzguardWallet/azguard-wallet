import type { ContractClassesCapability, Capability } from "@aztec/aztec.js/wallet"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

export class ContractClassesUICapability extends UICapability {
	constructor(capability: ContractClassesCapability) {
		super(capability, "Contract class metadata")
	}

	get cap(): ContractClassesCapability {
		return this.capability as ContractClassesCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.canGetMetadata) keys.push("canGetMetadata")
		if (this.cap.classes !== "*") {
			for (const c of this.cap.classes) keys.push(`class:${String(c)}`)
		}
		return keys
	}

	isMeaningful(): boolean {
		if (!this.cap.canGetMetadata || this.denials.has("canGetMetadata")) return false
		return this.cap.classes === "*" || this.cap.classes.some(c => !this.denials.has(`class:${String(c)}`))
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability
		const cap = { ...this.cap }
		if (this.denials.has("canGetMetadata")) cap.canGetMetadata = false
		if (cap.classes !== "*") {
			cap.classes = cap.classes.filter(c => !this.denials.has(`class:${String(c)}`))
			if (cap.classes.length === 0 && !cap.canGetMetadata) return null
		}
		if (!cap.canGetMetadata) return null
		return cap
	}

	getSections(): Section[] {
		const c = this.cap
		const s: Section[] = []
		if (c.canGetMetadata) s.push({ type: "sub", key: "canGetMetadata", label: "Get class metadata" })
		if (c.classes === "*") {
			s.push({ type: "wildcard", label: "Classes" })
		} else {
			const items = c.classes.map(c => String(c))
			s.push({ type: "grid", items, keyPrefix: "class", variant: "address" })
		}
		return s
	}
}
