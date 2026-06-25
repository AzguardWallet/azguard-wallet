import { loadContractArtifact } from "@aztec/stdlib/abi";
import { NoirCompiledContract } from "@aztec/stdlib/noir";
import PrivateFPCJson from "./PrivateFPC.json" with { type: "json" };

// PrivateFPC artifact — recompiled from the external aztec-fee-payment repo (regenerate it there on each Aztec bump).
export const PrivateFPCContractArtifact = loadContractArtifact(PrivateFPCJson as NoirCompiledContract);
