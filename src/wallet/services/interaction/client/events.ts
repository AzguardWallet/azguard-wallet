import { EventMessage } from "@/wallet/base/messages";
import { type DappSession, INTERACTION_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceEvent {
    DappSessionAdded,
    DappSessionDroped,
}

export class InteractionServiceEventMessage extends EventMessage {
    constructor(
        event: InteractionServiceEvent,
        public readonly dappSession: DappSession,
    ) {
        super(INTERACTION_SERVICE_NAME, event);
    }
}
