// Contract artifact names are "AzguardAccount" and "AzguardAccountPersistent" (on-chain identity).
// Do not rename the JSON artifacts — the names are embedded in compiled bytecode.
import type { NoirCompiledContract } from "@aztec/stdlib/noir"

import azguardV0 from "../artifacts/azguard-v0.json" with { type: "json" }
import azguardV0Persistent from "../artifacts/azguard-v0-persistent.json" with { type: "json" }

export const vibeguardV0Artifact = azguardV0 as unknown as NoirCompiledContract
export const vibeguardV0PersistentArtifact = azguardV0Persistent as unknown as NoirCompiledContract
