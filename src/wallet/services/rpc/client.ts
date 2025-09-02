import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import { Events, GenericRpcEvent, Methods, RPC_SERVICE_NAME } from "./spec";

export * from "./spec";

export class RpcServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onGenericEvent = new EventHandler<GenericRpcEvent>();

    public constructor(name?: string) {
        super(RPC_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public invoke(fn: string, args: unknown): Promise<[string, unknown]> {
        return this.request("invoke", fn, args);
    }
}
