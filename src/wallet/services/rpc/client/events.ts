import { EventMessage } from "@/wallet/base/messages";
import { RPC_SERVICE_NAME } from ".";

export enum RpcServiceEvent {
    GenericEvent,
}

export class RpcServiceEventMessage extends EventMessage {
    constructor(
        public readonly name: string,
        public readonly payload: [string, any],
    ) {
        super(RPC_SERVICE_NAME, RpcServiceEvent.GenericEvent);
    }
}