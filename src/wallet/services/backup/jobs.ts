/**
 * The one running job of the backup service: an export being downloaded. The service
 * holds at most one job at a time — a newer begin* evicts the current one — and every
 * later call names its job by the op ticket the begin* minted.
 */

import { OutgoingFile } from "./transfer";

/** An export job: the file split for the port, chunks served by index. */
export class ExportJob {
    private readonly outgoing: OutgoingFile;

    public constructor(
        public readonly id: number,
        file: string,
    ) {
        this.outgoing = new OutgoingFile(file);
    }

    public get chunks(): number {
        return this.outgoing.count;
    }

    public getChunk(index: number): string {
        return this.outgoing.getChunk(index);
    }
}
