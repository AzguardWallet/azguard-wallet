/**
 * The one running job of the backup service: an export being downloaded, or an
 * import being received, inspected and restored. The service holds at most one job at
 * a time — a newer begin* evicts the current one, whichever direction it ran — and
 * every later call names its job by the op ticket the begin* minted.
 */

import { IncomingFile, OutgoingFile } from "./transfer";
import { ParsedBackup, decryptBackupText, detectBackupType, parseBackupFile } from "./format";
import { BackupFileType } from "./spec";

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

/**
 * The received file as the import currently understands it. Each transition
 * replaces the previous form.
 */
export type ImportContent =
    | { kind: BackupFileType; text: string }
    | { kind: "parsed"; backup: ParsedBackup };

/**
 * An import walking the chain received chunks → sniffed text → decrypted text → parse.
 * The last put assembles and sniffs the file, so the content exists exactly from
 * the moment every chunk arrived — getContent() is a plain guard. decrypt() and
 * parse() replace the form with the next one; the parse is kept, so inspect and
 * finish read the file once.
 */
export class ImportJob {
    private readonly incoming: IncomingFile;
    private form?: ImportContent;

    public constructor(
        public readonly id: number,
        declaredChunks: number,
    ) {
        this.incoming = new IncomingFile(declaredChunks);
    }

    public put(index: number, data: string): void {
        this.incoming.put(index, data);
        if (this.incoming.isComplete) {
            const text = this.incoming.assemble();
            this.form = { kind: detectBackupType(text), text };
        }
    }

    /** The received file as currently understood. Refuses until every chunk arrived. */
    public getContent(): ImportContent {
        if (!this.form) {
            throw new Error("Import is not fully received");
        }
        return this.form;
    }

    /**
     * encrypted → plain (or unknown, when the container held something else).
     * A wrong password throws and changes nothing.
     */
    public async decrypt(password: string): Promise<void> {
        const content = this.getContent();
        if (content.kind !== "encrypted") {
            throw new Error("Uploaded file is not encrypted");
        }
        const text = await decryptBackupText(content.text, password);
        this.form = { kind: detectBackupType(text), text };
    }

    /** text → parsed. Invalid JSON throws and leaves the current form in place. */
    public parse(): ParsedBackup {
        const content = this.getContent();
        if (content.kind === "parsed") {
            return content.backup;
        }
        const backup = parseBackupFile(content.text);
        this.form = { kind: "parsed", backup };
        return backup;
    }
}
