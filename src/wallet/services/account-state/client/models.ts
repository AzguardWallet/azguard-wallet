/**
 * Incoming note info.
 */
export class Note {
    /**
     * Creates PxeNote instance.
     * @param note The note as emitted from the Noir contract.
     * @param owner The owner whose public key was used to encrypt the note.
     * @param contractAddress The contract address this note is created in.
     * @param storageSlot The specific storage location of the note on the contract.
     * @param txHash The hash of the tx the note was created in.
     * @param nonce The nonce of the note.
     */
    constructor(
        public readonly note: string[],
        public readonly owner: string,
        public readonly contractAddress: string,
        public readonly storageSlot: string,
        public readonly txHash: string,
        public readonly nonce: string,
    ) {}
}

export enum NoteStatus {
    All,
    Active,
    //Nullified,
}
