import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, Methods, TOKEN_SERVICE_NAME, TokenInfo, TokenInterface } from "./spec";

export * from "./spec";

export class TokenServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onTokenAdded = new EventHandler<TokenInfo>();
    public readonly onTokenUpdated = new EventHandler<TokenInfo>();
    public readonly onTokenDeleted = new EventHandler<TokenInfo>();

    public constructor(name?: string) {
        super(TOKEN_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getTokens(profileId?: string, chainId?: number): Promise<TokenInfo[]> {
        return this.request("getTokens", profileId, chainId);
    }

    public getToken(id: number): Promise<TokenInfo> {
        return this.request("getToken", id);
    }

    public addToken(
        profileId: string,
        networkId: string,
        accountAddress: string,
        tokenInterface: TokenInterface,
    ): Promise<TokenInfo> {
        return this.request("addToken", profileId, networkId, accountAddress, tokenInterface);
    }

    public updateToken(
        profileId: string,
        networkId: string,
        accountAddress: string,
        tokenId: number,
        tokenInterface: TokenInterface,
    ): Promise<TokenInfo> {
        return this.request("updateToken", profileId, networkId, accountAddress, tokenId, tokenInterface);
    }

    public deleteToken(id: number): Promise<TokenInfo> {
        return this.request("deleteToken", id);
    }

    public getTokenInterface(networkId: string, tokenId: number): Promise<TokenInterface> {
        return this.request("getTokenInterface", networkId, tokenId);
    }

    public parseTokenInterface(networkId: string, contract: string): Promise<TokenInterface> {
        return this.request("parseTokenInterface", networkId, contract);
    }
}
