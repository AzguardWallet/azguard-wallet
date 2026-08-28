import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { BACKUP_SERVICE_NAME, Events, Methods, StartedExport } from "./spec";
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
