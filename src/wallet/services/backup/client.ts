import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import {
    BACKUP_SERVICE_NAME,
    BackupInspection,
    Events,
    ImportReport,
    Methods,
    StartedExport,
} from "./spec";
import { IncomingFile, OutgoingFile } from "./transfer";

export * from "./spec";

export class BackupServiceClient
    extends ServiceClient<Methods, Events>
    implements ServiceSpec<Methods, Events> {
    public constructor(name?: string) {
        super(BACKUP_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public beginExport(masterKey: string, encryptionPassword?: string): Promise<StartedExport> {
        return this.request("beginExport", masterKey, encryptionPassword);
    }

    public getExportChunk(op: number, index: number): Promise<string> {
        return this.request("getExportChunk", op, index);
    }

    public finishExport(op: number): Promise<void> {
        return this.request("finishExport", op);
    }

    public beginImport(chunks: number): Promise<number> {
        return this.request("beginImport", chunks);
    }

    public putImportChunk(op: number, index: number, data: string): Promise<void> {
        return this.request("putImportChunk", op, index, data);
    }

    public inspectImport(op: number): Promise<BackupInspection> {
        return this.request("inspectImport", op);
    }

    public abortImport(op: number): Promise<void> {
        return this.request("abortImport", op);
    }

    public decryptImport(op: number, password: string): Promise<BackupInspection> {
        return this.request("decryptImport", op, password);
    }

    public finishImport(op: number, password?: string): Promise<ImportReport> {
        return this.request("finishImport", op, password);
    }

    /**
     * Sends a backup file into the service: begin, then every chunk in order. Returns
     * the job's op ticket and deliberately does not finish it — the file stays with the
     * job for inspectImport and finishImport, and finishImport is what drops it.
     */
    public async sendImport(file: string): Promise<number> {
        const outgoing = new OutgoingFile(file);
        const op = await this.beginImport(outgoing.count);
        for (let i = 0; i < outgoing.count; i++) {
            await this.putImportChunk(op, i, outgoing.getChunk(i));
        }
        return op;
    }

    /** Fetches the whole export across the port: begin, every chunk in order, finish. */
    public async fetchExport(masterKey: string, encryptionPassword?: string): Promise<string> {
        const { op, chunks } = await this.beginExport(masterKey, encryptionPassword);
        const incoming = new IncomingFile(chunks);
        for (let i = 0; i < chunks; i++) {
            incoming.put(i, await this.getExportChunk(op, i));
        }
        await this.finishExport(op);
        return incoming.assemble();
    }
}
