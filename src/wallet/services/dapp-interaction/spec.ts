import type { AppCapabilities, GrantedCapability } from "@aztec/aztec.js/wallet";
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
    AztecGetAccountsOperation,
    AztecRegisterContractOperation,
    AztecRegisterContractClassOperation,
    AztecSimulateTxOperation,
    AztecExecuteUtilityOperation,
    AztecProfileTxOperation,
    AztecSendTxOperation,
    AztecCreateAuthWitOperation,
} from "@/wallet/services/execution/spec";

export const DAPP_INTERACTION_SERVICE_NAME = "dapp-interaction";

export type DappInteraction = {
    id: string;
    payload: InteractionPayload;
    resolve: (result: InteractionResult) => void;
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
    source?: "rpc" | "walletconnect" | "sdk";
};

export type ConnectionResult = DappSessionInfo & {
    remember?: boolean;
};

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
    | AztecGetAccountsRequest
    | AztecRegisterContractRequest
    | AztecRegisterContractClassRequest
    | AztecSimulateTxRequest
    | AztecExecuteUtilityRequest
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

export type AztecGetAccountsRequest = Omit<AztecGetAccountsOperation, NetworkParams | "accounts"> & {
    chain: CaipChain;
};

export type AztecRegisterContractRequest = Omit<AztecRegisterContractOperation, NetworkParams> & {
    chain: CaipChain;
};

export type AztecRegisterContractClassRequest = Omit<AztecRegisterContractClassOperation, NetworkParams> & {
    chain: CaipChain;
    classId?: string; // derived wallet-side
};

export type AztecSimulateTxRequest = Omit<AztecSimulateTxOperation, AccountParams> & {
    account: CaipAccount;
};

export type AztecExecuteUtilityRequest = Omit<AztecExecuteUtilityOperation, AccountParams> & {
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

export type CapabilitiesParams = {
    sessionId: string;
    manifest: AppCapabilities;
    dappMetadata: DappMetadata;
    chainId: number;
    verificationHash?: string;
};

export type CapabilitiesPayload = {
    params: CapabilitiesParams;
};

export type CapabilitiesResult = {
    granted: GrantedCapability[];
    permissions: DappPermissions[];
    accounts: string[];
};

export type ExecutionResult = OperationResult[];

/**
 * Payload for the emoji verification window shown when an SDK session is established.
 * The verificationHash is derived from the ECDH key exchange (see @aztec/wallet-sdk crypto)
 * and is rendered as an emoji grid for visual anti-MITM comparison with the dApp.
 */
export type VerificationPayload = {
    params: {
        dappMetadata: DappMetadata;
        verificationHash: string;
    };
};

export type VerificationResult = {
    /** "mismatch" means the user reported the emojis differ from the dApp's — the session must be terminated */
    action: "match" | "mismatch";
};

/** Any interaction window's payload, discriminated at the call site by the window route. */
export type InteractionPayload = ConnectionPayload | ExecutionPayload | CapabilitiesPayload | VerificationPayload;

/** The matching result for any interaction window. */
export type InteractionResult = ConnectionResult | ExecutionResult | CapabilitiesResult | VerificationResult;

export type Methods = {
    getInteractionPayload(id: string): InteractionPayload;
    resolveInteraction(id: string, result: InteractionResult): void;
    rejectInteraction(id: string, reason: string): void;
};

export type Events = {
    onInteractionCancelled: string;
};
