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
    AztecGetContractClassMetadataOperation,
    AztecGetContractMetadataOperation,
    AztecGetPrivateEventsOperation,
    AztecGetChainInfoOperation,
    AztecRegisterSenderOperation,
    AztecGetAddressBookOperation,
    AztecRegisterContractOperation,
    AztecSimulateTxOperation,
    AztecSimulateUtilityOperation,
    AztecProfileTxOperation,
    AztecSendTxOperation,
    AztecCreateAuthWitOperation,
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
    // Azguard interface:
    | GetCompleteAddressRequest
    | RegisterContractRequest
    | RegisterSenderRequest
    | RegisterTokenRequest
    | SendTransactionRequest
    | SimulateTransactionRequest
    | SimulateUtilityRequest
    | SimulateViewsRequest
    // Aztec.js interface:
    | AztecGetContractClassMetadataRequest
    | AztecGetContractMetadataRequest
    | AztecGetPrivateEventsRequest
    | AztecGetChainInfoRequest
    | AztecRegisterSenderRequest
    | AztecGetAddressBookRequest
    | AztecRegisterContractRequest
    | AztecSimulateTxRequest
    | AztecSimulateUtilityRequest
    | AztecProfileTxRequest
    | AztecSendTxRequest
    | AztecCreateAuthWitRequest;

export type CaipChain = `aztec:${number}`;
export type CaipAccount = `${CaipChain}:${string}`;

type NetworkParams = "networkId";
type AccountParams = NetworkParams | "accountAddress";
type SendParams = AccountParams | "feeSettings";

// Azguard interface:

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

// Aztec.js interface:

export type AztecGetContractClassMetadataRequest = Omit<AztecGetContractClassMetadataOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetContractMetadataRequest = Omit<AztecGetContractMetadataOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetPrivateEventsRequest = Omit<AztecGetPrivateEventsOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetChainInfoRequest = Omit<AztecGetChainInfoOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterSenderRequest = Omit<AztecRegisterSenderOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetAddressBookRequest = Omit<AztecGetAddressBookOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterContractRequest = Omit<AztecRegisterContractOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecSimulateTxRequest = Omit<AztecSimulateTxOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecSimulateUtilityRequest = Omit<AztecSimulateUtilityOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecProfileTxRequest = Omit<AztecProfileTxOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecSendTxRequest = Omit<AztecSendTxOperation, SendParams> & {
    account: CaipAccount;
};

export type AztecCreateAuthWitRequest = Omit<AztecCreateAuthWitOperation, AccountParams> & {
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
