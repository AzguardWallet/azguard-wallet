import { EventMessage } from "@/wallet/base/port-service/messages";
import { DappSession, DAPP_SESSION_SERVICE_NAME } from ".";

export enum DappSessionServiceEvent {
    DappSessionAdded,
    DappSessionUpdated,
    DappSessionDeleted,
}

export class DappSessionServiceEventMessage extends EventMessage {
    constructor(
        event: DappSessionServiceEvent,
        public readonly dappSession: DappSession,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, event);
    }
}