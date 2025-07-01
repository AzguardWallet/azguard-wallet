import { EventMessage } from "@/wallet/base/message-service/messages";
import { CONSOLE_SNIFFER_SERVICE_NAME } from "./index";
import type { LogEntity } from "@/wallet/services/logger/client";

export enum ConsoleSnifferServiceEvent {
    LogAdded,
}

export class ConsoleSnifferServiceEventMessage extends EventMessage<ConsoleSnifferServiceEvent, LogEntity> {
    constructor(
        event: ConsoleSnifferServiceEvent,
        public readonly payload: LogEntity,
    ) {
        super(
            { event, payload },
            CONSOLE_SNIFFER_SERVICE_NAME,
        );
    }
}
