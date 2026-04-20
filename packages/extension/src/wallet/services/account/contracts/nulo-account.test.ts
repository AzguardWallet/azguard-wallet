import { describe, expect, it } from "vitest"
import { SchnorrAccountContractArtifact } from "@aztec/accounts/schnorr"

/**
 * Surface-level guard. The full reference-determinism check (matching
 * `getSchnorrAccountContractAddress(seed, Fr.ZERO)` against a CLI-derived address)
 * requires Barretenberg's WASM runtime, which the vitest jsdom env doesn't load.
 *
 * Run it manually with:
 *   bunx aztec-wallet create-account --from-secret-key 0x...deadbeef --salt 0
 * and compare against `getSchnorrAccountContractAddress(seed, Fr.ZERO)` inside the
 * extension (popup console, after unlock). Any drift = upstream changed the
 * derivation or our salt pinning is broken; both are migration-level events.
 */
describe("NuloAccount artifact wiring", () => {
	it("imports the upstream SchnorrAccount artifact without recompiling", () => {
		expect(SchnorrAccountContractArtifact.name).toBeDefined()
		expect(SchnorrAccountContractArtifact.functions.length).toBeGreaterThan(0)
		const ctor = SchnorrAccountContractArtifact.functions.find((f) => f.name === "constructor")
		expect(ctor).toBeDefined()
	})
})
