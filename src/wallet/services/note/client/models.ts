export class Note {
    /**
     * @param contract The contract address this note is created in.
     * @param storageSlot The specific storage location of the note on the contract.
     * @param txHash The hash of the tx the note was created in.
     * @param rawContent Data stored inside the note (decoded if it's a known type, or encoded otherwise).
     * @param type Guessed type of the note.
     * @param location Location in the contract storage.
     * @param content Parsed (according to the guessed type) content.
     */
    constructor(
        public readonly contract: string,
        public readonly storageSlot: string,
        public readonly txHash: string,
        public readonly rawContent: string[],
        public readonly type?: string,
        public readonly location?: string,
        public readonly content?: Record<string, string>,
    ) {}
}
