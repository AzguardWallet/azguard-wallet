import { Service } from "@/wallet/base/message-service/service.ts";
import { LogLevel } from "../logger/client";
import { CONSOLE_SNIFFER_SERVICE_NAME, ConsoleSnifferServiceEvent } from "./client";

export class ConsoleSnifferService extends Service<void, ConsoleSnifferServiceEvent> {
    public constructor(
        private readonly source: string,
    ) {
        super(CONSOLE_SNIFFER_SERVICE_NAME);

        this.patchConsoleMethods()
    }
    
    protected async onRequest(method: unknown, params: unknown): Promise<unknown> {
        switch (method) {
            default: {
                throw new Error("Unknown method");
            }
        }
    }

    private patchConsoleMethods() {
        for (const level of Object.values(LogLevel)) {
            const cbName = "on" + level[0].toUpperCase() + level.slice(1);

            (window as any)[cbName] = (...args: any[]) => {
                const newLogEntity = {
                    level,
                    args,
                    source: this.source,
                };

                this.emit(ConsoleSnifferServiceEvent.LogAdded, newLogEntity);
            };
        }
    }
}