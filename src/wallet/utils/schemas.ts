import { ContractArtifactSchema } from "@aztec/stdlib/abi";
import { ContractClassWithIdSchema, ContractInstanceWithAddressSchema, ProtocolContractAddressesSchema } from "@aztec/stdlib/contract";
import { ContractClassMetadata, ContractMetadata, PXEInfo } from "@aztec/stdlib/interfaces/client";
import { optional, ZodFor } from "@aztec/foundation/schemas";
import { PrivateKernelTailCircuitPublicInputs } from "@aztec/stdlib/kernel";
import { ClientIvcProof } from "@aztec/stdlib/proofs";
import { PrivateExecutionResult, ProvingTimingsSchema, TxProvingResult } from "@aztec/stdlib/tx";
import { z } from "zod";

// copied from aztec.js, because it's not exported

export const ContractClassMetadataSchema = z.object({
    contractClass: z.union([ContractClassWithIdSchema, z.undefined()]),
    isContractClassPubliclyRegistered: z.boolean(),
    artifact: z.union([ContractArtifactSchema, z.undefined()]),
}) satisfies ZodFor<ContractClassMetadata>;

export const ContractMetadataSchema = z.object({
    contractInstance: z.union([ContractInstanceWithAddressSchema, z.undefined()]),
    isContractInitialized: z.boolean(),
    isContractPubliclyDeployed: z.boolean(),
}) satisfies ZodFor<ContractMetadata>;
  
export const PXEInfoSchema = z.object({
    pxeVersion: z.string(),
    protocolContractAddresses: ProtocolContractAddressesSchema,
}) satisfies ZodFor<PXEInfo>;

// TODO: remove when https://github.com/AztecProtocol/aztec-packages/pull/14498 merged
export const TxProvingResultSchema = z.object({
    privateExecutionResult: PrivateExecutionResult.schema,
    publicInputs: PrivateKernelTailCircuitPublicInputs.schema,
    clientIvcProof: ClientIvcProof.schema,
    timings: optional(ProvingTimingsSchema),
}).transform(TxProvingResult.from);