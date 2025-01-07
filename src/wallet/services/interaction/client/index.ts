import type { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { InteractionServiceEvent, type InteractionServiceEventMessage } from "./events";
import type { GetDappSessionParams, DappSession, InteractionRequest, Namespaces } from "./models";
import {
    AddDappSessionRequest,
    DeleteInteractionRequestRequest,
    DropDappSessionRequest,
    GetDappSessionRequest,
    GetDappSessionsRequest,
    GetInteractionRequestRequest,
    ApproveInteractionRequestRequest,
    RejectInteractionRequestRequest,
    BuildApprovedNamespacesRequest,
} from "./methods";
import type { Account } from "../../account/client";

export * from './events';
export * from './methods';
export * from './models';

export const INTERACTION_SERVICE_NAME = "interaction";

/**
 * Client for interaction with the InteractionService via messaging API
 */
export class InteractionServiceClient extends ServiceClient {
    /**
     * Creates InteractionServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onDappSessionAdded Callback, called when a new dapp session was added.
     * @param onDappSessionDroped Callback, called when an existing dapp session has droped.
     * @param onRequestExpired Callback, called when an existing interaction request has expired.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onDappSessionAdded?: (dappSession: DappSession) => void,
        private readonly onDappSessionDroped?: (dappSession: DappSession) => void,
        private readonly onRequestExpired?: (interactionRequest: InteractionRequest) => void,
    ) {
        super(INTERACTION_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case InteractionServiceEvent.DappSessionAdded:
                if (this.onDappSessionAdded) {
                    const dappSession = (message as InteractionServiceEventMessage).dappSession
                    if (dappSession) {
                        try {this.onDappSessionAdded(dappSession)}
                        catch {}
                        }
                }
                break;
            case InteractionServiceEvent.DappSessionDroped:
                if (this.onDappSessionDroped) {
                    const dappSession = (message as InteractionServiceEventMessage).dappSession
                    if (dappSession) {
                        try {this.onDappSessionDroped(dappSession)}
                        catch {}
                    }
                }
                break;
            case InteractionServiceEvent.RequestExpired:
                if (this.onRequestExpired) {
                    const interactionRequest = (message as InteractionServiceEventMessage).interactionRequest
                    if (interactionRequest) {
                        try {this.onRequestExpired(interactionRequest)}
                        catch {}
                    }
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of active dapp sessions.
     */
    public getDappSessions(profileId: string): Promise<DappSession[]> {
        return this.request(new GetDappSessionsRequest(profileId))
    }

    /**
     * Returns a dapp session with the specified id, or undefined if it doesn't exist.
     * @param id Dapp session id.
     */
    public getDappSession(id: string): Promise<DappSession | undefined> {
        return this.request(new GetDappSessionRequest(id))
    }
    
    /**
     * Drops dapp session with the specified id.
     * @param id Dapp session internal id.
     * @emits `DappSessionDrop` event.
     */
    public dropDappSession(id: string, emit?: boolean): Promise<void> {
        return this.request(new DropDappSessionRequest(id, emit));
    }

    /**
     * Returns an interaction request with the specified id, or undefined if it doesn't exist.
     * @param id Interaction request id.
     */
    public getInteractionRequest(id: string): Promise<InteractionRequest | undefined> {
        return this.request(new GetInteractionRequestRequest(id));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public approveInteractionRequest(id: string, namespaces: Namespaces, profileId: string): Promise<any> {
        return this.request(new ApproveInteractionRequestRequest(id, namespaces, profileId));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public rejectInteractionRequest(id: string, reason?: string): Promise<any> {
        return this.request(new RejectInteractionRequestRequest(id, reason));
    }

    /**
     * Delete the interaction request with the specified id.
     * @param id Interaction request id.
     */
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public deleteInteractionRequest(id: string): Promise<any> {
        return this.request(new DeleteInteractionRequestRequest(id));
    }

    public buildApprovedNamespaces(requiredNamespaces: Namespaces, supportedNamespaces: Namespaces, optionalNamespaces?: Namespaces): Promise<Namespaces> {
        return this.request(new BuildApprovedNamespacesRequest(requiredNamespaces, supportedNamespaces, optionalNamespaces));
    }
}
