import type { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { InteractionServiceEvent, type InteractionServiceEventMessage } from "./events";
import type { DappSession, InteractionRequest } from "./models";
import {
    AddDappSessionRequest,
    DeleteInteractionRequestRequest,
    DropDappSessionRequest,
    GetDappSessionRequest,
    GetDappSessionsRequest,
    GetInteractionRequestRequest,
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
     * @param onDappSessionDroped Callback, called when an existing dapp session was droped.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onDappSessionAdded?: (dappSession: DappSession) => void,
        private readonly onDappSessionDroped?: (dappSession: DappSession) => void,
    ) {
        super(INTERACTION_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case InteractionServiceEvent.DappSessionAdded:
                if (this.onDappSessionAdded) {
                    try {this.onDappSessionAdded((message as InteractionServiceEventMessage).dappSession);}
                    catch {}
                }
                break;
            case InteractionServiceEvent.DappSessionDroped:
                if (this.onDappSessionDroped) {
                    try {this.onDappSessionDroped((message as InteractionServiceEventMessage).dappSession);}
                    catch {}
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
        return this.request(new GetDappSessionsRequest(profileId));
    }

    /**
     * Returns a dapp session with the specified id, or undefined if it doesn't exist.
     * @param id Dapp session id.
     */
    public getDappSession(id: string): Promise<DappSession | undefined> {
        return this.request(new GetDappSessionRequest(id));
    }
    
    // /**
    //  * Creates and returns a new dapp session.
    //  * @param name Display dapp name.
    //  * @param topic Wallet connect dapp session id.
    //  * @param expiry Dapp session expiration timestamp.
    //  * @param url Dapp URL.
    //  * @param icon Dapp icon.
    //  * @emits `DappSessionAdded` event.
    //  */
    // public addDappSession(name: string, topic: string, expiry: number, profileId: string, accounts: Array<Account>, url?: string, icon?: string): Promise<DappSession> {
    //     return this.request(new AddDappSessionRequest(name, topic, expiry, profileId, accounts, url, icon));
    // }
    
    /**
     * Drops dapp session with the specified id.
     * @param id Dapp session internal id.
     * @emits `DappSessionDrop` event.
     */
    public dropDappSession(id: string): Promise<void> {
        return this.request(new DropDappSessionRequest(id));
    }

    /**
     * Returns an interaction request with the specified id, or undefined if it doesn't exist.
     * @param id Interaction request id.
     */
    public getInteractionRequest(id: string): Promise<InteractionRequest | undefined> {
        return this.request(new GetInteractionRequestRequest(id));
    }

    /**
     * Delete the interaction request with the specified id.
     * @param id Interaction request id.
     */
    
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public deleteInteractionRequest(id: string): Promise<any> {
        return this.request(new DeleteInteractionRequestRequest(id));
    }
}
