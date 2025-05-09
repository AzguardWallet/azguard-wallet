import { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { DappSessionServiceEvent, DappSessionServiceEventMessage } from "./events";
import { AccessLevel, DappMetadata, DappPermissions, DappSession } from "./models";
import {
    GetDappSessionsRequest,
    GetDappSessionRequest,
    AddDappSessionRequest,
    UpdateDappSessionRequest,
    DeleteDappSessionRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const DAPP_SESSION_SERVICE_NAME = "dapp-session";

/**
 * Client for interaction with the DappSessionServiceClient via messaging API
 */
export class DappSessionServiceClient extends ServiceClient {
    /**
     * Creates DappSessionServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onDappSessionAdded Callback, called when a new dapp session was created.
     * @param onDappSessionUpdated Callback, called when an existing dapp session was updated.
     * @param onDappSessionDeleted Callback, called when an existing dapp session was deleted.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onDappSessionAdded?: (session: DappSession) => void,
        private readonly onDappSessionUpdated?: (session: DappSession) => void,
        private readonly onDappSessionDeleted?: (session: DappSession) => void,
    ) {
        super(DAPP_SESSION_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case DappSessionServiceEvent.DappSessionAdded:
                if (this.onDappSessionAdded) {
                    try {this.onDappSessionAdded((message as DappSessionServiceEventMessage).dappSession);}
                    catch {}
                }
                break;
            case DappSessionServiceEvent.DappSessionUpdated:
                if (this.onDappSessionUpdated) {
                    try {this.onDappSessionUpdated((message as DappSessionServiceEventMessage).dappSession);}
                    catch {}
                }
                break;
            case DappSessionServiceEvent.DappSessionDeleted:
                if (this.onDappSessionDeleted) {
                    try {this.onDappSessionDeleted((message as DappSessionServiceEventMessage).dappSession);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    public getDappSessions(): Promise<DappSession[]> {
        return this.request(new GetDappSessionsRequest());
    }

    public getDappSession(sessionId: string): Promise<DappSession> {
        return this.request(new GetDappSessionRequest(sessionId));
    }

    public addDappSession(
        dappMetadata: DappMetadata,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        return this.request(new AddDappSessionRequest(dappMetadata, permissions, accounts, confirmationLevel));
    }

    public updateDappSession(
        sessionId: string,
        permissions: DappPermissions[],
        accounts: string[],
        confirmationLevel: AccessLevel,
    ): Promise<DappSession> {
        return this.request(new UpdateDappSessionRequest(sessionId, permissions, accounts, confirmationLevel));
    }

    public deleteDappSession(sessionId: string): Promise<DappSession> {
        return this.request(new DeleteDappSessionRequest(sessionId));
    }
}
