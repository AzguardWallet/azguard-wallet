import type { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { WalletConnectServiceEvent, type WalletConnectServiceEventMessage } from "./events";
import {
    ConnectByURIRequest,
    ApproveDappSessionRequest,
    RejectDappSessionRequest,
    DropDappSessionRequest,
    ValidateProposalRequest,
    ConfirmSessionRequestRequest,
    RejectSessionRequestRequest,
} from "./methods";
import type { DappSession } from "@/wallet/services/interaction/client/models";
import type { Account } from "@/wallet/services/account/client/models";

export * from './events';
export * from './methods';
export * from './models';

export const WALLET_CONNECT_SERVICE_NAME = "wallet-connect";

/**
 * Client for interaction with external services via messaging API
 */
export class WalletConnectServiceClient extends ServiceClient {
    /**
     * Creates WalletConnectServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        private readonly onProposalExpire?: (payload: any) => void,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        private readonly onRequestExpire?: (payload: any) => void,
    ) {
        super(WALLET_CONNECT_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case WalletConnectServiceEvent.ProposalExpire:
                if (this.onProposalExpire) {
                    try {this.onProposalExpire((message as WalletConnectServiceEventMessage).payload);}
                    catch {}
                }
                break;
            case WalletConnectServiceEvent.RequestExpire:
                if (this.onRequestExpire) {
                    try {this.onRequestExpire((message as WalletConnectServiceEventMessage).payload);}
                    catch {}
                }
                break;
                // case NetworkServiceEvent.NetworkUpdated:
            //     if (this.onNetworkUpdated) {
            //         try {this.onNetworkUpdated((message as NetworkServiceEventMessage).network);}
            //         catch {}
            //     }
            //     break;
            // case NetworkServiceEvent.NetworkDeleted:
            //     if (this.onNetworkDeleted) {
            //         try {this.onNetworkDeleted((message as NetworkServiceEventMessage).network);}
            //         catch {}
            //     }
            //     break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    public connectByURI(uri: string): Promise<void> {
        return this.request(new ConnectByURIRequest(uri));
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public validateProposal(payload: any, address: string): Promise<void> {
        return this.request(new ValidateProposalRequest(payload, address));
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public approveDappSession(payload: any, profileId: string, accounts: Array<Account>): Promise<DappSession | undefined> {
        return this.request(new ApproveDappSessionRequest(payload, profileId, accounts));
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public rejectDappSession(payload: any): Promise<void> {
        return this.request(new RejectDappSessionRequest(payload));
    }
    public dropDappSession(dappSession: DappSession): Promise<void> {
        return this.request(new DropDappSessionRequest(dappSession));
    }

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public confirmRequest(networkId: string, accountAddress: string, dappName: string, payload: any): Promise<string> {
        return this.request(new ConfirmSessionRequestRequest(networkId, accountAddress, dappName, payload));
    }
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    public rejectRequest(payload: any): Promise<void> {
        return this.request(new RejectSessionRequestRequest(payload));
    }
}
