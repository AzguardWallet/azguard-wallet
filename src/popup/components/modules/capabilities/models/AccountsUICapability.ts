import type { AccountsCapability, Capability } from "@aztec/aztec.js/wallet"
import type { Account } from "@/wallet/services/account/spec"
import type { Section } from "./UICapability"
import { UICapability } from "./UICapability"

export class AccountsUICapability extends UICapability {
	accounts: Account[] = []

	constructor(capability: AccountsCapability) {
		super(capability, "Account access")
	}

	get cap(): AccountsCapability {
		return this.capability as AccountsCapability
	}

	getDeniableKeys(): string[] {
		const keys: string[] = []
		if (this.cap.canGet) keys.push("canGet")
		if (this.cap.canCreateAuthWit) keys.push("canCreateAuthWit")
		for (const acc of this.accounts) keys.push(`account:${acc.address}`)
		return keys
	}

	isMeaningful(): boolean {
		const c = this.cap
		const d = this.denials
		const hasSub = (c.canGet && !d.has("canGet")) || (c.canCreateAuthWit && !d.has("canCreateAuthWit"))
		if (!hasSub) return false
		if (this.accounts.length === 0) return false
		return this.accounts.some(a => !d.has(`account:${a.address}`))
	}

	buildNarrowed(): Capability | null {
		if (!this.selected) return null
		if (this.denials.size === 0) return this.capability
		const cap = { ...this.cap }
		if (this.denials.has("canGet")) cap.canGet = false
		if (this.denials.has("canCreateAuthWit")) cap.canCreateAuthWit = false
		if (!cap.canGet && !cap.canCreateAuthWit) return null
		return cap
	}

	/** Returns addresses of non-denied accounts, for building the approval result. */
	getApprovedAddresses(): string[] {
		return this.accounts
			.filter(a => !this.denials.has(`account:${a.address}`))
			.map(a => a.address)
	}

	getSections(): Section[] {
		const s: Section[] = []
		if (this.cap.canGet) s.push({ type: "sub", key: "canGet", label: "Get accounts" })
		if (this.cap.canCreateAuthWit) s.push({ type: "sub", key: "canCreateAuthWit", label: "Create auth witnesses" })
		s.push({ type: "grid", items: this.accounts, keyPrefix: "account", variant: "account" })
		return s
	}
}
