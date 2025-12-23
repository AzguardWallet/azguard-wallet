import { ContractArtifactSchema, EventSelector } from "@aztec/stdlib/abi";
import {
    ContractClassWithIdSchema,
    ContractInstanceWithAddressSchema,
    ContractClassMetadata,
    ContractMetadata,
} from "@aztec/stdlib/contract";
import { Fr } from "@aztec/foundation/curves/bn254";
import { bufferSchema, ZodFor } from "@aztec/foundation/schemas";
import { Note, NoteDao } from "@aztec/stdlib/note";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { inTxSchema, TxHash } from "@aztec/stdlib/tx";
import { BlockNumberSchema } from "@aztec/foundation/branded-types";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";
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

export const NoteDaoSchema = z.object({
    note: Note.schema,
    contractAddress: AztecAddress.schema,
    owner: AztecAddress.schema,
    storageSlot: Fr.schema,
    randomness: Fr.schema,
    noteNonce: Fr.schema,
    noteHash: Fr.schema,
    siloedNullifier: Fr.schema,
    txHash: TxHash.schema,
    l2BlockNumber: BlockNumberSchema,
    l2BlockHash: z.string(),
    index: z.coerce.bigint(),
    toBuffer: z.function().returns(bufferSchema),
    equals: z.function().returns(z.boolean()),
    getSize: z.function().returns(z.number()),
}) satisfies ZodFor<NoteDao>;

export const PackedPrivateEventSchema = z.intersection(
    inTxSchema(),
    z.object({
        packedEvent: z.array(Fr.schema),
        eventSelector: EventSelector.schema,
    }),
) satisfies ZodFor<PackedPrivateEvent>;
