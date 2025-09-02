import type { DappSession } from "@/wallet/services/dapp-session/spec";
import type { ConnectionParams, ExecutionParams, DappSessionInfo, OperationResult } from "./types";

export const DAPP_INTERACTION_SERVICE_NAME = "dapp-interaction";

export * from "./types";

export type DappInteraction = {
    id: string;
    payload: ConnectionPayload | ExecutionPayload;
    resolve: (result: ConnectionResult | ExecutionResult) => void;
    reject: (reason: string) => void;
    cancellationToken: string;
};

export type ConnectionPayload = {
    params: ConnectionParams;
};

export type ConnectionResult = DappSessionInfo;

export type ExecutionPayload = {
    params: ExecutionParams;
    session: DappSession;
};

export type ExecutionResult = OperationResult[];

export type Methods = {
    getInteractionPayload(id: string): ConnectionPayload | ExecutionPayload;
    resolveInteraction(id: string, result: ConnectionResult | ExecutionResult): void;
    rejectInteraction(id: string, reason: string): void;
};

export type Events = {
    onInteractionCancelled: string;
};
