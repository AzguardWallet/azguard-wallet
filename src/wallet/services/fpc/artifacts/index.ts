import { loadContractArtifact } from "@aztec/stdlib/abi";
import { NoirCompiledContract } from "@aztec/stdlib/noir";
import PrivateFPCJson from "./PrivateFPC.json" with { type: "json" };

// rc.2 artifact lacks `file_map[*].function_locations` (added in v4.2.0) and `aztec_version` (added to NoirCompiledContract in v4.3.0); @aztec/stdlib abi.ts defaults both at runtime.
export const PrivateFPCContractArtifact = loadContractArtifact(PrivateFPCJson as unknown as NoirCompiledContract);
