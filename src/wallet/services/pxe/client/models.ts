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

export class Authwit {
    /**
     * Creates Authwit instance
     * @param owner Account created the authwit.
     * @param hash Message hash.
     * @param content Plain content.
     * @param isPublic Wither the authwit is public or private.
     */
    constructor(
        public readonly owner: string,
        public readonly hash: string,
        public readonly content: AuthwitCallContent | AuthwitIntentContent | undefined,
        public readonly isPublic: boolean,
    ) {}
}

export type AuthwitCallContent = {
    /** Who can make the call. */
    caller: string,
    /** What contract can be called. */
    contract: string,
    /** What method can be called. */
    method: string,
    /** What args can be passed. */
    args: any[],
}

export type AuthwitIntentContent = {
    /** Who can consume the authwit. */
    consumer: string,
    /** Plain intent. */
    intent: string[],
}