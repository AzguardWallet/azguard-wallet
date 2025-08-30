import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { Methods, WALLET_CONNECT_SERVICE_NAME } from "./spec";

export * from "./spec";

export class WalletConnectServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(name?: string) {
        super(WALLET_CONNECT_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public connectByURI(uri: string): Promise<void> {
        return this.request("connectByURI", uri);
    }
}
