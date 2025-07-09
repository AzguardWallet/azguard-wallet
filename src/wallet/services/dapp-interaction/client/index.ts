import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { DappInteractionServiceEvent, type DappInteractionServiceEventMessage } from "./events";
import type {
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
     * Creates DappInteractionServiceClient instance.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onInteractionCancelled Callback, called when a dapp interaction was cancelled.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onInteractionCancelled?: (interactionId: string) => void,
    ) {
        super(DAPP_INTERACTION_SERVICE_NAME, new LoggerServiceClient, onConnected, onDisconnected);
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
                this.logError(`Unexpected event type ${message.event}.`);
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
