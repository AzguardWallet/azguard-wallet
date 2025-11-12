import { AbiTypeSchema, ContractArtifactSchema, EventMetadataDefinition, EventSelector } from "@aztec/stdlib/abi";
import {
    ContractClassWithIdSchema,
    ContractInstanceWithAddressSchema,
    ContractClassMetadata,
    ContractMetadata,
} from "@aztec/stdlib/contract";
import { ZodFor } from "@aztec/foundation/schemas";
import z from "zod";

// copied from aztec.js, because it's not exported

export const ContractClassMetadataSchema = z.object({
    contractClass: z.union([ContractClassWithIdSchema, z.undefined()]),
    isContractClassPubliclyRegistered: z.boolean(),
    artifact: z.union([ContractArtifactSchema, z.undefined()]),
}) satisfies ZodFor<ContractClassMetadata>;

export const ContractMetadataSchema = z.object({
    contractInstance: z.union([ContractInstanceWithAddressSchema, z.undefined()]),
    isContractInitialized: z.boolean(),
    isContractPublished: z.boolean(),
}) satisfies ZodFor<ContractMetadata>;

export const EventMetadataDefinitionSchema = z.object({
    eventSelector: EventSelector.schema,
    abiType: AbiTypeSchema,
    fieldNames: z.array(z.string()),
}) satisfies ZodFor<EventMetadataDefinition>;
