import { EventMessage } from "@/wallet/base/messages";
import { ServiceClient } from "@/wallet/base/service-client";
import { FpcServiceEvent, FpcServiceEventMessage } from "./events";
import { FpcInfo, FpcType } from "./models";
import { GetFpcsRequest, AddFpcRequest, DeleteFpcRequest } from "./methods";

export * from "./events";
export * from "./methods";
export * from "./models";

export const FPC_SERVICE_NAME = "fpc";

/**
 * Client for interaction with the FpcService via messaging API
 */
export class FpcServiceClient extends ServiceClient {
    /**
     * Creates FpcServiceClient instace.
     * @param onConnected Callback, called when the client is connected to the background service.
     * @param onDisconnected Callback, called when the client is disconnected from the background service.
     * @param onFpcAdded Callback, called when a new transaction was created.
     * @param onFpcUpdated Callback, called when an existing transaction was updated.
     * @param onFpcDeleted Callback, called when an existing transaction was updated.
     */
    constructor(
        onConnected?: () => void,
        onDisconnected?: () => void,
        private readonly onFpcAdded?: (fpc: FpcInfo) => void,
        private readonly onFpcUpdated?: (fpc: FpcInfo) => void,
        private readonly onFpcDeleted?: (fpc: FpcInfo) => void,
    ) {
        super(FPC_SERVICE_NAME, onConnected, onDisconnected);
    }

    protected onEvent(message: EventMessage): void {
        switch (message.event) {
            case FpcServiceEvent.FpcAdded:
                if (this.onFpcAdded) {
                    try {
                        this.onFpcAdded((message as FpcServiceEventMessage).fpc);
                    } catch {}
                }
                break;
            case FpcServiceEvent.FpcUpdated:
                if (this.onFpcUpdated) {
                    try {
                        this.onFpcUpdated((message as FpcServiceEventMessage).fpc);
                    } catch {}
                }
                break;
            case FpcServiceEvent.FpcDeleted:
                if (this.onFpcDeleted) {
                    try {
                        this.onFpcDeleted((message as FpcServiceEventMessage).fpc);
                    } catch {}
                }
                break;
            default:
                console.error(`Unexpected event type ${message.event}.`);
                break;
        }
    }

    /**
     * Returns a list of FPCs.
     * @param chainId Filter by chain id.
     */
    public getFpcs(chainId?: number): Promise<FpcInfo[]> {
        return this.request(new GetFpcsRequest(chainId));
    }

    /**
     * Adds a new FPC
     * @param networkId network id
     * @param type FPC type
     * @param address FPC address
     * @param name alias name
     */
    public addFpc(networkId: string, type: FpcType, address: string, name?: string): Promise<FpcInfo> {
        return this.request(new AddFpcRequest(networkId, type, address, name));
    }

    /**
     * Deletes an FPC.
     * @param id FPC id.
     */
    public deleteFpc(id: string): Promise<FpcInfo> {
        return this.request(new DeleteFpcRequest(id));
    }
}
