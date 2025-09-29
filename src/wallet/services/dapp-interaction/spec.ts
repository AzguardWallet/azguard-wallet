import type { DappSession, DappMetadata, DappPermissions } from "@/wallet/services/dapp-session/spec";
import type {
    GetCompleteAddressOperation,
    RegisterContractOperation,
    RegisterSenderOperation,
    RegisterTokenOperation,
    SimulateTransactionOperation,
    SendTransactionOperation,
    SimulateUtilityOperation,
    SimulateViewsOperation,
    OperationResult,
} from "@/wallet/services/execution/spec";

export const DAPP_INTERACTION_SERVICE_NAME = "dapp-interaction";

export type DappInteraction = {
    id: string;
    payload: ConnectionPayload | ExecutionPayload;
    resolve: (result: ConnectionResult | ExecutionResult) => void;
    reject: (reason: string) => void;
    cancellationToken: string;
};

export type DappSessionInfo = {
    id: string;
    permissions: DappPermissions[];
    accounts: string[];
};

export type ConnectionPayload = {
    params: ConnectionParams;
};

export type ConnectionParams = {
    dappMetadata: DappMetadata;
    requiredPermissions: DappPermissions[];
    optionalPermissions?: DappPermissions[];
};

export type ConnectionResult = DappSessionInfo;

export type ExecutionPayload = {
    params: ExecutionParams;
    session: DappSession;
};

export type ExecutionParams = {
    sessionId: string;
    operations: OperationRequest[];
};

export type OperationRequest =
    | GetCompleteAddressRequest
    | RegisterContractRequest
    | RegisterSenderRequest
    | RegisterTokenRequest
    | SendTransactionRequest
    | SimulateTransactionRequest
    | SimulateUtilityRequest
    | SimulateViewsRequest;

export type CaipChain = `aztec:${number}`;
export type CaipAccount = `${CaipChain}:${string}`;

type NetworkParams = "networkId";
type AccountParams = NetworkParams | "accountAddress";
type SendParams = AccountParams | "feeSettings";

export type GetCompleteAddressRequest = Omit<GetCompleteAddressOperation, AccountParams> & {
    account: CaipAccount;
};

export type RegisterContractRequest = Omit<RegisterContractOperation, NetworkParams> & {
    chain: CaipChain;
};

export type RegisterSenderRequest = Omit<RegisterSenderOperation, NetworkParams> & {
    chain: CaipChain;
};

export type RegisterTokenRequest = Omit<RegisterTokenOperation, AccountParams> & {
    account: CaipAccount;
};

export type SendTransactionRequest = Omit<SendTransactionOperation, SendParams> & {
    account: CaipAccount;
};

export type SimulateTransactionRequest = Omit<SimulateTransactionOperation, AccountParams> & {
    account: CaipAccount;
};

export type SimulateUtilityRequest = Omit<SimulateUtilityOperation, AccountParams> & {
    account: CaipAccount;
};

export type SimulateViewsRequest = Omit<SimulateViewsOperation, AccountParams> & {
    account: CaipAccount;
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
