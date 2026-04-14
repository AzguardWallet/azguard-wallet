import { EventSelector } from "@aztec/stdlib/abi"
import { Fr } from "@aztec/foundation/curves/bn254"
import type { ZodFor } from "@aztec/foundation/schemas"
import { Note, NoteStatus } from "@aztec/stdlib/note"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { inTxSchema, TxHash } from "@aztec/stdlib/tx"
import { BlockNumberSchema } from "@aztec/foundation/branded-types"
import type { PackedPrivateEvent, NotesFilter } from "@aztec/pxe/client/bundle"
import z from "zod"

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
	txIndexInBlock: z.number(),
	noteIndexInTx: z.number(),
})

export const PackedPrivateEventSchema = z.intersection(
	inTxSchema(),
	z.object({
		packedEvent: z.array(Fr.schema),
		eventSelector: EventSelector.schema,
	}),
) satisfies ZodFor<PackedPrivateEvent>

export const NotesFilterSchema = z.object({
	contractAddress: AztecAddress.schema,
	owner: AztecAddress.schema.optional(),
	storageSlot: Fr.schema.optional(),
	status: z.nativeEnum(NoteStatus).optional(),
	siloedNullifier: Fr.schema.optional(),
	scopes: z.array(AztecAddress.schema),
}) satisfies ZodFor<NotesFilter>
