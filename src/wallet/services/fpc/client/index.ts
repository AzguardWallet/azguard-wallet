import type { EventMessage } from "@/wallet/base/port-service/messages";
import { ServiceClient } from "@/wallet/base/port-service/service-client";
import { FpcServiceEvent, type FpcServiceEventMessage } from "./events";
import type { FpcInfo, FpcType } from "./models";
import { GetFpcRequest, GetFpcsRequest, AddFpcRequest, UpdateFpcRequest, DeleteFpcRequest } from "./methods";

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
     * @param onFpcDeleted Callback, called when an existing transaction was deleted.
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
     * Returns a FPC with the specified id.
     * @param fpcId FPC id.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the fpc with the specified id doesn't exist within the active profile.
     */
    public getFpc(fpcId: string): Promise<FpcInfo> {
        return this.request(new GetFpcRequest(fpcId));
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
     * Changes fpc display name and returns the updated fpc.
     * @param fpcId FPC id.
     * @param name New display name.
     * @emits `FpcUpdated` event.
     * @throws "Profile locked" if profile is locked.
     * @throws "Invalid id" if the FPC with the specified id doesn't exist within the active profile.
     */
    public updateFpc(fpcId: string, name: string): Promise<FpcInfo> {
        return this.request(new UpdateFpcRequest(fpcId, name));
    }

    /**
     * Deletes an FPC.
     * @param id FPC id.
     */
    public deleteFpc(id: string): Promise<FpcInfo> {
        return this.request(new DeleteFpcRequest(id));
    }
}
