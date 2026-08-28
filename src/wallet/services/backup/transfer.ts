/**
 * How a file crosses the popup ↔ service port in pieces: the sender side holds an
 * OutgoingFile, the receiver side an IncomingFile — the same pair on both transports
 * (client upload and service download). A violation of the transfer protocol throws.
 * Eviction of the job stays with the service.
 */

import { MAX_PORT_JSON_LENGTH } from "@/wallet/base/background/service";

/** A quarter of the port cap, so the envelope and Chrome's own overhead never matter. */
const BACKUP_CHUNK_SIZE = MAX_PORT_JSON_LENGTH / 4;

/** The one splitter of the chunk protocol. Never returns zero chunks. */
function chunkString(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let offset = 0; offset < text.length; offset += size) {
        chunks.push(text.slice(offset, offset + size));
    }
    return chunks.length ? chunks : [""];
}

/** A file to be sent: split once, chunks served by index. */
export class OutgoingFile {
    private readonly chunks: string[];

    public constructor(file: string) {
        this.chunks = chunkString(file, BACKUP_CHUNK_SIZE);
    }

    public get count(): number {
        return this.chunks.length;
    }

    public getChunk(index: number): string {
        if (!Number.isInteger(index) || index < 0 || index >= this.chunks.length) {
            throw new Error(`Chunk ${index} is out of range`);
        }
        return this.chunks[index];
    }
}

/**
 * A file being received: an accumulator of the declared chunks. assemble() validates
 * completeness and returns the joined file — what the file means is the caller's
 * business, the transfer only carries it.
 */
export class IncomingFile {
    private readonly declaredChunks: number;
    private readonly chunks: (string | undefined)[];
    private filled = 0;

    public constructor(declaredChunks: number) {
        if (!Number.isInteger(declaredChunks) || declaredChunks <= 0) {
            throw new Error(`Invalid chunk count: ${declaredChunks}`);
        }
        this.declaredChunks = declaredChunks;
        this.chunks = new Array(declaredChunks);
    }

    public put(index: number, data: string): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.declaredChunks) {
            throw new Error(`Chunk ${index} is out of range`);
        }
        if (typeof data !== "string") {
            throw new Error(`Chunk ${index} is not a string`);
        }
        if (this.chunks[index] !== undefined) {
            throw new Error(`Chunk ${index} was already received`);
        }
        this.chunks[index] = data;
        this.filled += 1;
    }

    public get isComplete(): boolean {
        return this.filled === this.declaredChunks;
    }

    /** The joined file. Refuses until every declared chunk has arrived. */
    public assemble(): string {
        if (!this.isComplete) {
            throw new Error("Import is not fully received");
        }
        return this.chunks.join("");
    }
}
