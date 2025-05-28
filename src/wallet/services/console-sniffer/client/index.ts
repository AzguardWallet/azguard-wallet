import { ServiceClient } from "@/wallet/base/message-service/service-client";
import { ConsoleSnifferServiceEvent } from "./events";
import type { LogEntity } from "@/wallet/services/logger/client";

export * from "./events";

export const CONSOLE_SNIFFER_SERVICE_NAME = "console-sniffer";

export class ConsoleSnifferServiceClient extends ServiceClient<void, ConsoleSnifferServiceEvent> {
    public constructor(
        name?: string,
        private readonly onLogAdded?: (log: LogEntity) => void,
    ) {
        super(CONSOLE_SNIFFER_SERVICE_NAME, name);
    }

    protected onEvent(event: ConsoleSnifferServiceEvent, payload: unknown): void {
        switch (event) {
            case ConsoleSnifferServiceEvent.LogAdded:
                if (this.onLogAdded) {
                    try {this.onLogAdded(payload as LogEntity);}
                    catch {}
                }
                break;
            default:
                // console.error(`Unexpected event type ${event}.`);
                break;
        }
    }
}
