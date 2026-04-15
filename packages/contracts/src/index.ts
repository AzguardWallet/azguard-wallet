// Contract artifact names are "AzguardAccount" and "AzguardAccountPersistent" (on-chain identity).
// Do not rename the JSON artifacts — the names are embedded in compiled bytecode.
// TypeScript wrapper uses Nulo branding.
import type { NoirCompiledContract } from "@aztec/stdlib/noir"

import azguardV0 from "../artifacts/azguard-v0.json" with { type: "json" }
import azguardV0Persistent from "../artifacts/azguard-v0-persistent.json" with { type: "json" }

export const nuloV0Artifact = azguardV0 as unknown as NoirCompiledContract
export const nuloV0PersistentArtifact = azguardV0Persistent as unknown as NoirCompiledContract
