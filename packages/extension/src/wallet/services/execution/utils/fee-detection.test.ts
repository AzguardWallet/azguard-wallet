import { describe, test, expect } from "vitest"
import { detectEmbeddedFeePayment, isNoFromRequest } from "./fee-detection"

describe("detectEmbeddedFeePayment", () => {
	test("returns undefined when feePayer is undefined or null", () => {
		expect(detectEmbeddedFeePayment(undefined, "0xabc")).toBeUndefined()
		expect(detectEmbeddedFeePayment(null, "0xabc")).toBeUndefined()
	})

	test('returns "fjwc" when feePayer equals from (FeeJuice with claim)', () => {
		const addr = "0x1a228350bbfa130d71aa1105c93e6432bd8c65476bc46ba579d2dc885e2873d1"
		expect(detectEmbeddedFeePayment(addr, addr)).toBe("fjwc")
	})

	test('returns "fpc" when feePayer differs from from (external FPC)', () => {
		const feePayer = "0x2ef4be56d83d448d37909ede8ac3a4ac69daab309584a1bceebbc9f0639f825c"
		const from = "0x1a228350bbfa130d71aa1105c93e6432bd8c65476bc46ba579d2dc885e2873d1"
		expect(detectEmbeddedFeePayment(feePayer, from)).toBe("fpc")
	})

	test("coerces AztecAddress-like objects via String() for comparison", () => {
		const feePayer = { toString: () => "0xabc" }
		const from = { toString: () => "0xdef" }
		expect(detectEmbeddedFeePayment(feePayer, from)).toBe("fpc")
	})

	test("matches when feePayer is an object and from is a string with same value", () => {
		const addr = "0xabc"
		const feePayer = { toString: () => addr }
		expect(detectEmbeddedFeePayment(feePayer, addr)).toBe("fjwc")
	})

	test('treats empty string feePayer as defined (returns "fpc", not undefined)', () => {
		expect(detectEmbeddedFeePayment("", "0xabc")).toBe("fpc")
	})
})

describe("isNoFromRequest", () => {
	test('returns true for "NO_FROM"', () => {
		expect(isNoFromRequest("NO_FROM")).toBe(true)
	})

	test("returns false for a normal address", () => {
		expect(isNoFromRequest("0x1a228350bbfa130d71aa1105c93e6432bd8c65476bc46ba579d2dc885e2873d1")).toBe(false)
	})

	test("is case-sensitive", () => {
		expect(isNoFromRequest("no_from")).toBe(false)
	})
})
