import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { DappInteractionServiceEvent, DappInteractionServiceEventMessage } from "./events";
import {
    ConnectionPayload,
    ConnectionResult,
    ExecutionPayload,
    ExecutionResult,
} from "./models";
import {
    GetInteractionPayloadRequest,
    ResolveInteractionRequest,
    RejectInteractionRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const DAPP_INTERACTION_SERVICE_NAME = "dapp-interaction";

/**
 * Client for interaction with the DappInteractionServiceClient via messaging API
 */
export class DappInteractionServiceClient extends ServiceClient {
    /**
     * Creates DappInteractionServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onInteractionCancelled Callback, called when a dapp interaction was cancelled.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onInteractionCancelled?: (interactionId: string) => void,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case DappInteractionServiceEvent.InteractionCancelled:
                if (this.onInteractionCancelled) {
                    try {this.onInteractionCancelled((message as DappInteractionServiceEventMessage).interactionId);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }
        
    public getInteractionPayload(id: string): Promise<ConnectionPayload | ExecutionPayload> {
        return this.request(new GetInteractionPayloadRequest(id));
    }

    public resolveInteraction(id: string, result: ConnectionResult | ExecutionResult): Promise<void> {
        return this.request(new ResolveInteractionRequest(id, result));
    }

    public rejectInteraction(id: string, reason: string): Promise<void> {
        return this.request(new RejectInteractionRequest(id, reason));
    }
}
