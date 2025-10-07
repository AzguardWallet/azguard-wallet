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
    AztecSimulateTxOperation,
    AztecSimulateUtilityOperation,
    AztecProfileTxOperation,
    AztecSendTxOperation,
    AztecGetContractClassMetadataOperation,
    AztecGetContractMetadataOperation,
    AztecRegisterContractOperation,
    AztecRegisterContractClassOperation,
    AztecProveTxOperation,
    AztecGetNodeInfoOperation,
    AztecGetPXEInfoOperation,
    AztecGetCurrentBaseFeesOperation,
    AztecUpdateContractOperation,
    AztecRegisterSenderOperation,
    AztecGetSendersOperation,
    AztecRemoveSenderOperation,
    AztecGetTxReceiptOperation,
    AztecGetPrivateEventsOperation,
    AztecGetPublicEventsOperation,
    AztecGetCompleteAddressOperation,
    AztecGetAddressOperation,
    AztecGetChainIdOperation,
    AztecGetVersionOperation,
    AztecCreateTxExecutionRequestOperation,
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
    // Azguard base:
    | GetCompleteAddressRequest
    | RegisterContractRequest
    | RegisterSenderRequest
    | RegisterTokenRequest
    | SendTransactionRequest
    | SimulateTransactionRequest
    | SimulateUtilityRequest
    | SimulateViewsRequest
    // Aztec.js PXE:
    | AztecSimulateTxRequest
    | AztecSimulateUtilityRequest
    | AztecProfileTxRequest
    | AztecSendTxRequest
    | AztecGetContractClassMetadataRequest
    | AztecGetContractMetadataRequest
    | AztecRegisterContractRequest
    | AztecRegisterContractClassRequest
    | AztecProveTxRequest
    | AztecGetNodeInfoRequest
    | AztecGetPXEInfoRequest
    | AztecGetCurrentBaseFeesRequest
    | AztecUpdateContractRequest
    | AztecRegisterSenderRequest
    | AztecGetSendersRequest
    | AztecRemoveSenderRequest
    | AztecGetTxReceiptRequest
    | AztecGetPrivateEventsRequest
    | AztecGetPublicEventsRequest
    // Aztec.js AccountInterface:
    | AztecGetCompleteAddressRequest
    | AztecGetAddressRequest
    | AztecGetChainIdRequest
    | AztecGetVersionRequest
    // Aztec.js EntrypointInterface:
    | AztecCreateTxExecutionRequestRequest
    // Aztec.js AuthWitnessProvider:
    | AztecCreateAuthWitRequest;

export type CaipChain = `aztec:${number}`;
export type CaipAccount = `${CaipChain}:${string}`;

type NetworkParams = "networkId";
type AccountParams = NetworkParams | "accountAddress";
type SendParams = AccountParams | "feeSettings";

// Azguard base:

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

// Aztec.js PXE:

export type AztecSimulateTxRequest = Omit<AztecSimulateTxOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecSimulateUtilityRequest = Omit<AztecSimulateUtilityOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecProfileTxRequest = Omit<AztecProfileTxOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecSendTxRequest = Omit<AztecSendTxOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetContractClassMetadataRequest = Omit<AztecGetContractClassMetadataOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetContractMetadataRequest = Omit<AztecGetContractMetadataOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterContractRequest = Omit<AztecRegisterContractOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterContractClassRequest = Omit<AztecRegisterContractClassOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecProveTxRequest = Omit<AztecProveTxOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetNodeInfoRequest = Omit<AztecGetNodeInfoOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetPXEInfoRequest = Omit<AztecGetPXEInfoOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetCurrentBaseFeesRequest = Omit<AztecGetCurrentBaseFeesOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecUpdateContractRequest = Omit<AztecUpdateContractOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterSenderRequest = Omit<AztecRegisterSenderOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetSendersRequest = Omit<AztecGetSendersOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRemoveSenderRequest = Omit<AztecRemoveSenderOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetTxReceiptRequest = Omit<AztecGetTxReceiptOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetPrivateEventsRequest = Omit<AztecGetPrivateEventsOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetPublicEventsRequest = Omit<AztecGetPublicEventsOperation, NetworkParams> & {
    chain: CaipChain;
};

// Aztec.js AccountInterface:

export type AztecGetCompleteAddressRequest = Omit<AztecGetCompleteAddressOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecGetAddressRequest = Omit<AztecGetAddressOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecGetChainIdRequest = Omit<AztecGetChainIdOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecGetVersionRequest = Omit<AztecGetVersionOperation, NetworkParams> & {
    chain: CaipChain;
};

// Aztec.js EntrypointInterface:

export type AztecCreateTxExecutionRequestRequest = Omit<AztecCreateTxExecutionRequestOperation, AccountParams> & {
    account: CaipAccount;
};

// Aztec.js AuthWitnessProvider:

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
