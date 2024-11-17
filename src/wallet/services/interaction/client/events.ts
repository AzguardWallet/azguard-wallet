import { EventMessage } from "@/wallet/base/messages";
import { type Dapp, INTERACTION_SERVICE_NAME } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceEvent {
    DappAdded,
    DappDeleted,
}

export class InteractionServiceEventMessage extends EventMessage {
    constructor(
        event: InteractionServiceEvent,
        public readonly dapp: Dapp
    ) {
        super(INTERACTION_SERVICE_NAME, event);
    }
}
