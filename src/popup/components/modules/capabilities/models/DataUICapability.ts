import type { DataCapability, Capability } from "@aztec/aztec.js/wallet"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

export class DataUICapability extends UICapability {
	constructor(capability: DataCapability) {
		super(capability, "Data access")
	}

	get cap(): DataCapability {
		return this.capability as DataCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.addressBook) keys.push("addressBook")
		if (this.cap.privateEvents) {
			keys.push("privateEvents")
			if (this.cap.privateEvents.contracts !== "*") {
				for (const c of this.cap.privateEvents.contracts) keys.push(`event_source:${String(c)}`)
			}
		}
		return keys
	}

	isMeaningful(): boolean {
		const c = this.cap
		const d = this.denials

		const addressBookOk = c.addressBook && !d.has("addressBook")
		const eventsOk = c.privateEvents
			&& !d.has("privateEvents")
			&& (c.privateEvents.contracts === "*" || c.privateEvents.contracts.some(c => !d.has(`event_source:${String(c)}`)))

		return !!(addressBookOk || eventsOk)
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability

		const cap: DataCapability = { ...this.cap }
		if (this.denials.has("addressBook")) cap.addressBook = false

		if (this.denials.has("privateEvents")) {
			delete cap.privateEvents
		} else if (cap.privateEvents && cap.privateEvents.contracts !== "*") {
			const filtered = cap.privateEvents.contracts.filter(c => !this.denials.has(`event_source:${String(c)}`))
			if (filtered.length === 0) {
				delete cap.privateEvents
			} else {
				cap.privateEvents = { contracts: filtered }
			}
		}

		if (!cap.addressBook && !cap.privateEvents) return null
		return cap
	}

	getSections(): Section[] {
		const s: Section[] = []
		if (this.cap.addressBook) s.push({ type: "sub", key: "addressBook", label: "Address book access" })
		if (this.cap.privateEvents) {
			s.push({ type: "sub", key: "privateEvents", label: "Private events access" })
			const contracts = this.cap.privateEvents.contracts
			if (contracts === "*") {
				s.push({ type: "wildcard", label: "Event sources" })
			} else {
				const items = contracts.map(c => String(c))
				s.push({ type: "grid", items, keyPrefix: "event_source", variant: "address" })
			}
		}
		return s
	}
}
