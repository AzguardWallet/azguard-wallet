import { EventMessage } from "@/wallet/base/messages";
import { FpcInfo, FPC_SERVICE_NAME } from ".";

export enum FpcServiceEvent {
    FpcAdded,
    FpcUpdated,
    FpcDeleted,
}

export class FpcServiceEventMessage extends EventMessage {
    constructor(
        event: FpcServiceEvent,
        public readonly fpc: FpcInfo,
    ) {
        super(FPC_SERVICE_NAME, event);
    }
}
