import { describe, test, expect } from "vitest"
import { enforceScope } from "./scope-enforcement"
import type { Capability, GrantedCapabilityRecord } from "../dapp-session/spec"

// ── Helpers ───────────────────────────────────────────────────────────

const grant = (cap: Capability): GrantedCapabilityRecord => ({
	capability: cap,
	grantedAt: Date.now(),
})

/** Mock AztecAddress-like object with toString(). */
const addr = (hex: string) => ({ toString: () => hex })

const ADDR_A = "0x1111111111111111111111111111111111111111111111111111111111111111"
const ADDR_B = "0x2222222222222222222222222222222222222222222222222222222222222222"
const CLASS_A = "0xaaaa"

// ── Pass-through (no scope dimension) ─────────────────────────────────

describe("pass-through methods", () => {
	test("unknown method with empty grants does not throw", () => {
		expect(() => enforceScope("unknownMethod", [], [])).not.toThrow()
	})

	test("registerSender has no scope checker", () => {
		expect(() => enforceScope("registerSender", [addr(ADDR_A)], [])).not.toThrow()
	})

	test("getAddressBook has no scope checker", () => {
		expect(() => enforceScope("getAddressBook", [], [])).not.toThrow()
	})
})

// ── registerContract ──────────────────────────────────────────────────

describe("registerContract", () => {
	test("wildcard contracts + canRegister passes", () => {
		const grants = [grant({ type: "contracts", contracts: "*", canRegister: true })]
		expect(() => enforceScope("registerContract", [{ address: addr(ADDR_A) }], grants)).not.toThrow()
	})

	test("specific address in list + canRegister passes", () => {
		const grants = [grant({ type: "contracts", contracts: [ADDR_A], canRegister: true })]
		expect(() => enforceScope("registerContract", [{ address: addr(ADDR_A) }], grants)).not.toThrow()
	})

	test("address NOT in list throws", () => {
		const grants = [grant({ type: "contracts", contracts: [ADDR_A], canRegister: true })]
		expect(() => enforceScope("registerContract", [{ address: addr(ADDR_B) }], grants)).toThrow(/Scope violation/)
	})

	test("canRegister: false with wildcard throws", () => {
		const grants = [grant({ type: "contracts", contracts: "*", canRegister: false })]
		expect(() => enforceScope("registerContract", [{ address: addr(ADDR_A) }], grants)).toThrow(/Scope violation/)
	})
})

// ── getContractMetadata ───────────────────────────────────────────────

describe("getContractMetadata", () => {
	test("wildcard + canGetMetadata passes", () => {
		const grants = [grant({ type: "contracts", contracts: "*", canGetMetadata: true })]
		expect(() => enforceScope("getContractMetadata", [addr(ADDR_A)], grants)).not.toThrow()
	})

	test("address in list passes", () => {
		const grants = [grant({ type: "contracts", contracts: [ADDR_A], canGetMetadata: true })]
		expect(() => enforceScope("getContractMetadata", [addr(ADDR_A)], grants)).not.toThrow()
	})

	test("address not in list throws", () => {
		const grants = [grant({ type: "contracts", contracts: [ADDR_A], canGetMetadata: true })]
		expect(() => enforceScope("getContractMetadata", [addr(ADDR_B)], grants)).toThrow(/Scope violation/)
	})
})

// ── getContractClassMetadata ──────────────────────────────────────────

describe("getContractClassMetadata", () => {
	test("wildcard classes passes", () => {
		const grants = [grant({ type: "contractClasses", classes: "*", canGetMetadata: true })]
		expect(() => enforceScope("getContractClassMetadata", [addr(CLASS_A)], grants)).not.toThrow()
	})

	test("class ID in list passes", () => {
		const grants = [grant({ type: "contractClasses", classes: [CLASS_A], canGetMetadata: true })]
		expect(() => enforceScope("getContractClassMetadata", [addr(CLASS_A)], grants)).not.toThrow()
	})

	test("class ID not in list throws", () => {
		const grants = [grant({ type: "contractClasses", classes: [CLASS_A], canGetMetadata: true })]
		expect(() => enforceScope("getContractClassMetadata", [addr("0xbbbb")], grants)).toThrow(/Scope violation/)
	})
})

// ── sendTx ────────────────────────────────────────────────────────────

describe("sendTx", () => {
	const exec = (calls: { to: { toString(): string }; name: string }[]) => ({ calls })

	test("wildcard scope passes", () => {
		const grants = [grant({ type: "transaction", scope: "*" })]
		expect(() => enforceScope("sendTx", [exec([{ to: addr(ADDR_A), name: "transfer" }])], grants)).not.toThrow()
	})

	test("specific contract+function match passes", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "transfer" }] })]
		expect(() => enforceScope("sendTx", [exec([{ to: addr(ADDR_A), name: "transfer" }])], grants)).not.toThrow()
	})

	test("contract with wildcard function passes", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "*" }] })]
		expect(() => enforceScope("sendTx", [exec([{ to: addr(ADDR_A), name: "anything" }])], grants)).not.toThrow()
	})

	test("call to out-of-scope contract throws", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "*" }] })]
		expect(() => enforceScope("sendTx", [exec([{ to: addr(ADDR_B), name: "transfer" }])], grants)).toThrow(/Scope violation/)
	})

	test("multi-call: one in scope, one out throws", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "*" }] })]
		const calls = [
			{ to: addr(ADDR_A), name: "transfer" },
			{ to: addr(ADDR_B), name: "mint" },
		]
		expect(() => enforceScope("sendTx", [exec(calls)], grants)).toThrow(/Scope violation/)
	})

	test("multi-call: all in scope passes", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: "*", function: "*" }] })]
		const calls = [
			{ to: addr(ADDR_A), name: "transfer" },
			{ to: addr(ADDR_B), name: "mint" },
		]
		expect(() => enforceScope("sendTx", [exec(calls)], grants)).not.toThrow()
	})

	test("empty calls array passes (vacuously true)", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "transfer" }] })]
		expect(() => enforceScope("sendTx", [exec([])], grants)).not.toThrow()
	})
})

// ── simulateTx ────────────────────────────────────────────────────────

describe("simulateTx", () => {
	const exec = (calls: { to: { toString(): string }; name: string }[]) => ({ calls })

	test("wildcard transactions scope passes", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: "*" } })]
		expect(() => enforceScope("simulateTx", [exec([{ to: addr(ADDR_A), name: "fn" }])], grants)).not.toThrow()
	})

	test("specific match passes", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: [{ contract: ADDR_A, function: "fn" }] } })]
		expect(() => enforceScope("simulateTx", [exec([{ to: addr(ADDR_A), name: "fn" }])], grants)).not.toThrow()
	})

	test("out of scope throws", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: [{ contract: ADDR_A, function: "fn" }] } })]
		expect(() => enforceScope("simulateTx", [exec([{ to: addr(ADDR_B), name: "fn" }])], grants)).toThrow(/Scope violation/)
	})

	test("no transactions sub-cap throws", () => {
		const grants = [grant({ type: "simulation", utilities: { scope: "*" } })]
		expect(() => enforceScope("simulateTx", [exec([{ to: addr(ADDR_A), name: "fn" }])], grants)).toThrow(/Scope violation/)
	})
})

// ── executeUtility ────────────────────────────────────────────────────

describe("executeUtility", () => {
	test("wildcard utilities scope passes", () => {
		const grants = [grant({ type: "simulation", utilities: { scope: "*" } })]
		expect(() => enforceScope("executeUtility", [{ to: addr(ADDR_A), name: "view_balance" }], grants)).not.toThrow()
	})

	test("specific match passes", () => {
		const grants = [grant({ type: "simulation", utilities: { scope: [{ contract: ADDR_A, function: "view_balance" }] } })]
		expect(() => enforceScope("executeUtility", [{ to: addr(ADDR_A), name: "view_balance" }], grants)).not.toThrow()
	})

	test("out of scope throws", () => {
		const grants = [grant({ type: "simulation", utilities: { scope: [{ contract: ADDR_A, function: "view_balance" }] } })]
		expect(() => enforceScope("executeUtility", [{ to: addr(ADDR_B), name: "view_balance" }], grants)).toThrow(/Scope violation/)
	})

	test("no utilities sub-cap throws", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: "*" } })]
		expect(() => enforceScope("executeUtility", [{ to: addr(ADDR_A), name: "fn" }], grants)).toThrow(/Scope violation/)
	})
})

// ── profileTx ─────────────────────────────────────────────────────────

describe("profileTx", () => {
	const exec = (calls: { to: { toString(): string }; name: string }[]) => ({ calls })

	test("wildcard passes", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: "*" } })]
		expect(() => enforceScope("profileTx", [exec([{ to: addr(ADDR_A), name: "fn" }])], grants)).not.toThrow()
	})

	test("out of scope throws", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: [{ contract: ADDR_A, function: "fn" }] } })]
		expect(() => enforceScope("profileTx", [exec([{ to: addr(ADDR_B), name: "fn" }])], grants)).toThrow(/Scope violation/)
	})
})

// ── simulateViews ─────────────────────────────────────────────────────

describe("simulateViews", () => {
	test("wildcard passes", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: "*" } })]
		expect(() => enforceScope("simulateViews", [[{ to: addr(ADDR_A), name: "view" }]], grants)).not.toThrow()
	})

	test("out of scope throws", () => {
		const grants = [grant({ type: "simulation", transactions: { scope: [{ contract: ADDR_A, function: "view" }] } })]
		expect(() => enforceScope("simulateViews", [[{ to: addr(ADDR_B), name: "view" }]], grants)).toThrow(/Scope violation/)
	})
})

// ── getPrivateEvents ──────────────────────────────────────────────────

describe("getPrivateEvents", () => {
	test("wildcard contracts passes", () => {
		const grants = [grant({ type: "data", privateEvents: { contracts: "*" } })]
		expect(() => enforceScope("getPrivateEvents", [{}, { contractAddress: addr(ADDR_A) }], grants)).not.toThrow()
	})

	test("contract in list passes", () => {
		const grants = [grant({ type: "data", privateEvents: { contracts: [ADDR_A] } })]
		expect(() => enforceScope("getPrivateEvents", [{}, { contractAddress: addr(ADDR_A) }], grants)).not.toThrow()
	})

	test("contract not in list throws", () => {
		const grants = [grant({ type: "data", privateEvents: { contracts: [ADDR_A] } })]
		expect(() => enforceScope("getPrivateEvents", [{}, { contractAddress: addr(ADDR_B) }], grants)).toThrow(/Scope violation/)
	})
})

// ── createAuthWit ─────────────────────────────────────────────────────

describe("createAuthWit", () => {
	const accountsCap = (canCreateAuthWit: boolean, accounts: string[]): Capability => ({
		type: "accounts",
		canCreateAuthWit,
		accounts: accounts.map((a) => ({ alias: "test", item: a })),
	})

	test("canCreateAuthWit + matching account passes", () => {
		const grants = [grant(accountsCap(true, [ADDR_A]))]
		expect(() => enforceScope("createAuthWit", [addr(ADDR_A), {}], grants)).not.toThrow()
	})

	test("canCreateAuthWit: false throws", () => {
		const grants = [grant(accountsCap(false, [ADDR_A]))]
		expect(() => enforceScope("createAuthWit", [addr(ADDR_A), {}], grants)).toThrow(/Scope violation/)
	})

	test("account not in list throws", () => {
		const grants = [grant(accountsCap(true, [ADDR_A]))]
		expect(() => enforceScope("createAuthWit", [addr(ADDR_B), {}], grants)).toThrow(/Scope violation/)
	})
})

// ── Edge cases ────────────────────────────────────────────────────────

describe("edge cases", () => {
	test("AztecAddress-like objects match string addresses in scope", () => {
		const grants = [grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "transfer" }] })]
		// addr() returns { toString: () => ADDR_A } — should match ADDR_A in scope
		expect(() => enforceScope("sendTx", [{ calls: [{ to: addr(ADDR_A), name: "transfer" }] }], grants)).not.toThrow()
	})

	test("multiple grants: first denies, second permits", () => {
		const grants = [
			grant({ type: "transaction", scope: [{ contract: ADDR_A, function: "*" }] }),
			grant({ type: "transaction", scope: [{ contract: ADDR_B, function: "*" }] }),
		]
		// ADDR_B is only in the second grant — should pass via ANY-grant semantics
		expect(() => enforceScope("sendTx", [{ calls: [{ to: addr(ADDR_B), name: "mint" }] }], grants)).not.toThrow()
	})

	test("empty scope pattern array rejects all calls", () => {
		const grants = [grant({ type: "transaction", scope: [] })]
		expect(() => enforceScope("sendTx", [{ calls: [{ to: addr(ADDR_A), name: "transfer" }] }], grants)).toThrow(/Scope violation/)
	})

	test("malformed args produce clear error", () => {
		const grants = [grant({ type: "transaction", scope: "*" })]
		expect(() => enforceScope("sendTx", [{ noCallsField: true }], grants)).toThrow(/exec\.calls/)
	})
})
