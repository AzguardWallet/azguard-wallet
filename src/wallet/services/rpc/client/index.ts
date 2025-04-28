import { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { RpcServiceEvent, RpcServiceEventMessage } from "./events";
import { InvokeRequest } from "./methods";

export * from './events';
export * from './methods';

export const RPC_SERVICE_NAME = "rpc";

/**
 * Client for interaction with the wallet via messaging API
 */
export class RpcServiceClient extends ServiceClient {
    /**
     * Creates RpcServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onGenericEvent Callback, called on external RPC events.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onGenericEvent?: (name: string, payload: [string, unknown]) => void,
    ) {
        super(RPC_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case RpcServiceEvent.GenericEvent:
                if (this.onGenericEvent) {
                    const { name, payload } = message as RpcServiceEventMessage;
                    try {this.onGenericEvent(name, payload);}
                    catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Invokes specified method with the specified args.
     * @param fn Name of the function to invoke.
     * @param args Arguments to pass.
     */
    public invoke(fn: string, args: unknown): Promise<[string, unknown]> {
        return this.request(new InvokeRequest(fn, args));
    }
}
