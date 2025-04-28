import { EventMessage } from "@/wallet/base/port-service/messages";
import { Network, NETWORK_SERVICE_NAME } from ".";

export enum NetworkServiceEvent {
    NetworkAdded,
    NetworkUpdated,
    NetworkDeleted,
    DefaultNetworkChanged,
}

export class NetworkServiceEventMessage extends EventMessage {
    constructor(
        event: NetworkServiceEvent,
        public readonly network: Network
    ) {
        super(NETWORK_SERVICE_NAME, event);
    }
}