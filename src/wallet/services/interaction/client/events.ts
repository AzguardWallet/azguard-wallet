import { EventMessage } from "@/wallet/base/messages";
import { DappSession, INTERACTION_SERVICE_NAME, InteractionRequest } from ".";

// biome-ignore lint/style/useEnumInitializers: <explanation>
export enum InteractionServiceEvent {
    DappSessionAdded,
    DappSessionDroped,
    RequestExpired,
}

export class InteractionServiceEventMessage extends EventMessage {
    public readonly dappSession?: DappSession
    public readonly interactionRequest?: InteractionRequest

    constructor(event: InteractionServiceEvent, dappSession: DappSession);
    constructor(event: InteractionServiceEvent, interactionRequest: InteractionRequest);

    constructor(
        event: InteractionServiceEvent,
        arg: DappSession | InteractionRequest | string
    ) {
        super(INTERACTION_SERVICE_NAME, event);

        if (arg instanceof DappSession) {
            this.dappSession = arg;
        } else if (arg instanceof InteractionRequest) {
            this.interactionRequest = arg;
        }
    }    
}
