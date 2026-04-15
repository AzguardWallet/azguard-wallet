import { loadContractArtifact } from "@aztec/stdlib/abi";
import { NoirCompiledContract } from "@aztec/stdlib/noir";
import PrivateFPCJson from "./PrivateFPC.json" with { type: "json" };

export const PrivateFPCContractArtifact = loadContractArtifact(PrivateFPCJson as NoirCompiledContract);
