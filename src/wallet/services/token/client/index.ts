import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import type { Account } from "@/wallet/services/account/client";
import type { Profile } from "@/wallet/services/profile/client";
import type { Network } from "@/wallet/services/network/client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { TokenServiceEvent, type TokenServiceEventMessage } from "./events";
import type { TokenInfo, TokenInterface } from "./models";
import {
    AddTokenRequest,
    DeleteTokenRequest,
    GetInterfaceRequest,
    GetTokenRequest,
    GetTokensRequest,
    ParseInterfaceRequest,
    UpdateTokenRequest,
} from "./methods";

export * from './events';
export * from './methods';
export * from './models';

export const TOKEN_SERVICE_NAME = "token";

/**
 * Client for interaction with the TokenService via messaging API
 */
export class TokenServiceClient extends ServiceClient {
    /**
     * Creates TokenServiceClient instance.
     * @param profile Current profile.
     * @param network Current network.
     * @param account Current account.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onTokenAdded Callback, called when a new token was created.
     * @param onTokenUpdated Callback, called when an existing token was updated.
     * @param onTokenDeleted Callback, called when an existing token was deleted.
     */
    constructor(
        private readonly profile: Profile,
        private readonly network: Network,
        private readonly account: Account,
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onTokenAdded?: (token: TokenInfo) => void,
        private readonly onTokenUpdated?: (token: TokenInfo) => void,
        private readonly onTokenDeleted?: (token: TokenInfo) => void,
    ) {
        super(TOKEN_SERVICE_NAME, new LoggerServiceClient, onConnected, onDisconnected);
        if (profile.id !== account.profileId || network.chainId !== account.chainId) {
            throw new Error("account doesn't match profile and network");
        }
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case TokenServiceEvent.TokenAdded:
                if (this.onTokenAdded) {
                    try {this.onTokenAdded((message as TokenServiceEventMessage).token);}
                    catch {}
                }
                break;
            case TokenServiceEvent.TokenUpdated:
                if (this.onTokenUpdated) {
                    try {this.onTokenUpdated((message as TokenServiceEventMessage).token);}
                    catch {}
                }
                break;
            case TokenServiceEvent.TokenDeleted:
                if (this.onTokenDeleted) {
                    try {this.onTokenDeleted((message as TokenServiceEventMessage).token);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of tokens.
     */
    public getTokens(): Promise<TokenInfo[]> {
        return this.request(new GetTokensRequest(this.profile.id, this.network.chainId));
    }

    /**
     * Returns a token with the specified id, or undefined if it doesn't exist.
     * @param id Token id.
     */
    public getToken(id: number): Promise<TokenInfo | undefined> {
        return this.request(new GetTokenRequest(id));
    }
    
    /**
     * Creates and returns a new token.
     * @param tokenInterface Token interface, determining token's functionality.
     * @emits `TokenAdded` event.
     */
    public addToken(tokenInterface: TokenInterface): Promise<TokenInfo> {
        return this.request(new AddTokenRequest(this.profile.id, this.network.id, this.account.address, tokenInterface));
    }
    
    /**
     * Updates token and returns it.
     * @param id Token id.
     * @param tokenInterface Token interface, determining token's functionality.
     * @emits `TokenUpdated` event.
     */
    public updateToken(id: number, tokenInterface: TokenInterface): Promise<TokenInfo> {
        return this.request(new UpdateTokenRequest(this.profile.id, this.network.id, this.account.address, id, tokenInterface));
    }

    /**
     * Deletes token with the specified id and returns it.
     * @param id Token id.
     * @emits `TokenDeleted` event.
     */
    public deleteToken(id: number): Promise<TokenInfo> {
        return this.request(new DeleteTokenRequest(id));
    }

    /**
     * Returns interface of the token with the specified id.
     * @param id Token id.
     */
    public getInterface(id: number): Promise<TokenInterface> {
        return this.request(new GetInterfaceRequest(this.network.id, id));
    }

    /**
     * Parses contract and returns token interface.
     * @param contract Token contract address.
     */
    public parseInterface(contract: string): Promise<TokenInterface> {
        return this.request(new ParseInterfaceRequest(this.network.id, contract));
    }
}
