import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, FPC_SERVICE_NAME, FpcInfo, FpcType, Methods } from "./spec";

export * from "./spec";

export class FpcServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onFpcAdded = new EventHandler<FpcInfo>();
    public readonly onFpcUpdated = new EventHandler<FpcInfo>();
    public readonly onFpcDeleted = new EventHandler<FpcInfo>();

    public constructor(name?: string) {
        super(FPC_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getFpcs(chainId?: number): Promise<FpcInfo[]> {
        return this.request("getFpcs", chainId);
    }

    public getFpc(id: string): Promise<FpcInfo> {
        return this.request("getFpc", id);
    }

    public addFpc(networkId: string, type: FpcType, address: string, name?: string): Promise<FpcInfo> {
        return this.request("addFpc", networkId, type, address, name);
    }

    public updateFpc(id: string, name: string): Promise<FpcInfo> {
        return this.request("updateFpc", id, name);
    }

    public deleteFpc(id: string): Promise<FpcInfo> {
        return this.request("deleteFpc", id);
    }
}
