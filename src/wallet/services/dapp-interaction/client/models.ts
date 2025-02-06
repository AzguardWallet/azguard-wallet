import { DappSession } from "@/wallet/services/dapp-session/client";
import {
    ConnectionParams,
    ExecutionParams,
    DappSessionInfo,
    OperationResult,    
} from "../types";

export type ConnectionPayload = {
    params: ConnectionParams,
}

export type ConnectionResult = DappSessionInfo;

export type ExecutionPayload = {
    params: ExecutionParams,
    session: DappSession,
}

export type ExecutionResult = OperationResult[];