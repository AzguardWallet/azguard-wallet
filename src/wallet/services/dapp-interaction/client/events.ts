import { EventMessage } from "@/wallet/base/messages";
import { DAPP_INTERACTION_SERVICE_NAME } from ".";

export enum DappInteractionServiceEvent {
    InteractionCancelled,
}

export class DappInteractionServiceEventMessage extends EventMessage {
    constructor(
        event: DappInteractionServiceEvent,
        public readonly interactionId: string,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, event);
    }
}