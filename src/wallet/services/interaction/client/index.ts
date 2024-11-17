import type { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { InteractionServiceEvent, type InteractionServiceEventMessage } from "./events";
import type { Dapp } from "./models";
import {
    AddDappRequest,
    DeleteDappRequest,
    GetDappRequest,
    GetDappsRequest,
} from "./methods";

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
     * @param onDappAdded Callback, called when a new dapp was added.
     * @param onDappDeleted Callback, called when an existing dapp was deleted.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onDappAdded?: (network: Dapp) => void,
        private readonly onDappDeleted?: (network: Dapp) => void,
    ) {
        super(INTERACTION_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case InteractionServiceEvent.DappAdded:
                if (this.onDappAdded) {
                    try {this.onDappAdded((message as InteractionServiceEventMessage).dapp);}
                    catch {}
                }
                break;
            case InteractionServiceEvent.DappDeleted:
                if (this.onDappDeleted) {
                    try {this.onDappDeleted((message as InteractionServiceEventMessage).dapp);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of connected dapps.
     */
    public getDapps(): Promise<Dapp[]> {
        return this.request(new GetDappsRequest());
    }

    /**
     * Returns a dapp with the specified id, or undefined if it doesn't exist.
     * @param id Dapp id.
     */
    public getDapp(id: string): Promise<Dapp | undefined> {
        return this.request(new GetDappRequest(id));
    }
    
    /**
     * Creates and returns a new dapp.
     * @param name Display name.
     * @emits `DappAdded` event.
     */
    public addDapp(name: string): Promise<Dapp> {
        return this.request(new AddDappRequest(name));
    }
    
    /**
     * Deletes dapp with the specified id.
     * @param id Dapp id.
     * @emits `DappDeleted` event.
     */
    public deleteDapp(id: string): Promise<void> {
        return this.request(new DeleteDappRequest(id));
    }
}
