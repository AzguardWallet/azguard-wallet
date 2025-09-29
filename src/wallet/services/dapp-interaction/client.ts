import { ServiceSpec } from "@/wallet/base";
import { ServiceClient } from "@/wallet/base/background";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { EventHandler } from "@/wallet/utils/event-handler";
import {
    ConnectionPayload,
    ConnectionResult,
    DAPP_INTERACTION_SERVICE_NAME,
    Events,
    ExecutionPayload,
    ExecutionResult,
    Methods,
} from "./spec";

export * from "./spec";

export class DappInteractionServiceClient extends ServiceClient<Methods, Events> implements ServiceSpec<Methods, Events> {
    public readonly onInteractionCancelled = new EventHandler<string>();

    public constructor(name?: string) {
        super(DAPP_INTERACTION_SERVICE_NAME, new LoggerServiceClient(), name);
    }

    public getInteractionPayload(id: string): Promise<ConnectionPayload | ExecutionPayload> {
        return this.request("getInteractionPayload", id);
    }

    public resolveInteraction(id: string, result: ConnectionResult | ExecutionResult): Promise<void> {
        return this.request("resolveInteraction", id, result);
    }

    public rejectInteraction(id: string, reason: string): Promise<void> {
        return this.request("rejectInteraction", id, reason);
    }
}
