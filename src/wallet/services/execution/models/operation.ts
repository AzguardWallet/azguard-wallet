import type { TxExecutionOptions } from "@aztec/entrypoints/interfaces";
import type { ExecutionPayload } from "@aztec/entrypoints/payload";
import type { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact, FunctionCall } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { GasSettings } from "@aztec/stdlib/gas";
import type { EventMetadataDefinition } from "@aztec/stdlib/interfaces/client";
import type { SimulationOverrides, PrivateExecutionResult, Tx, TxHash, TxExecutionRequest } from "@aztec/stdlib/tx";
import type { Action, CallAction, EncodedCallAction, FeeSettings } from ".";

export type OperationKind = Operation["kind"];

export type Operation =
    // Azguard base:
    | GetCompleteAddressOperation
    | RegisterContractOperation
    | RegisterSenderOperation
    | RegisterTokenOperation
    | SendTransactionOperation
    | SimulateTransactionOperation
    | SimulateUtilityOperation
    | SimulateViewsOperation
    // Aztec.js PXE:
    | AztecSimulateTxOperation
    | AztecSimulateUtilityOperation
    | AztecProfileTxOperation
    | AztecSendTxOperation
    | AztecGetContractClassMetadataOperation
    | AztecGetContractMetadataOperation
    | AztecRegisterContractOperation
    | AztecRegisterContractClassOperation
    | AztecProveTxOperation
    | AztecGetNodeInfoOperation
    | AztecGetPXEInfoOperation
    | AztecGetCurrentBaseFeesOperation
    | AztecUpdateContractOperation
    | AztecRegisterSenderOperation
    | AztecGetSendersOperation
    | AztecRemoveSenderOperation
    | AztecGetTxReceiptOperation
    | AztecGetPrivateEventsOperation
    | AztecGetPublicEventsOperation
    // Aztec.js AccountInterface:
    | AztecGetCompleteAddressOperation
    | AztecGetAddressOperation
    | AztecGetChainIdOperation
    | AztecGetVersionOperation
    // Aztec.js EntrypointInterface:
    | AztecCreateTxExecutionRequestOperation
    // Aztec.js AuthWitnessProvider:
    | AztecCreateAuthWitOperation;

// Azguard base:

export type GetCompleteAddressOperation = {
    readonly kind: "get_complete_address";
    readonly networkId: string;
    readonly accountAddress: string;
};

export type RegisterContractOperation = {
    readonly kind: "register_contract";
    readonly networkId: string;
    readonly address: string;
    readonly instance?: unknown;
    readonly artifact?: unknown;
};

export type RegisterSenderOperation = {
    readonly kind: "register_sender";
    readonly networkId: string;
    readonly address: string;
};

export type RegisterTokenOperation = {
    readonly kind: "register_token";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly address: string;
};

export type SendTransactionOperation = {
    readonly kind: "send_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    feeSettings: FeeSettings;
    readonly actions: Action[];
    setup?: Action[];
};

export type SimulateTransactionOperation = {
    readonly kind: "simulate_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly actions: Action[];
    readonly setup?: Action[];
    readonly simulatePublic?: boolean;
};

export type SimulateUtilityOperation = {
    readonly kind: "simulate_utility";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly contract: string;
    readonly method: string;
    readonly args: any[];
};

export type SimulateViewsOperation = {
    readonly kind: "simulate_views";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly calls: (CallAction | EncodedCallAction)[];
};

// Aztec.js PXE:

export type AztecSimulateTxOperation = {
    readonly kind: "aztec_simulateTx";
    readonly networkId: string;
    readonly txRequest: TxExecutionRequest;
    readonly simulatePublic: boolean;
    readonly skipTxValidation?: boolean;
    readonly skipFeeEnforcement?: boolean;
    readonly overrides?: SimulationOverrides;
    scopes?: AztecAddress[];
};

export type AztecSimulateUtilityOperation = {
    readonly kind: "aztec_simulateUtility";
    readonly networkId: string;
    readonly functionName: string;
    readonly args: any[];
    readonly to: AztecAddress;
    readonly authwits?: AuthWitness[];
    readonly from?: AztecAddress;
    scopes?: AztecAddress[];
};

export type AztecProfileTxOperation = {
    readonly kind: "aztec_profileTx";
    readonly networkId: string;
    readonly txRequest: TxExecutionRequest;
    readonly profileMode: "gates" | "execution-steps" | "full";
    readonly skipProofGeneration?: boolean;
    readonly msgSender?: AztecAddress;
};

export type AztecSendTxOperation = {
    readonly kind: "aztec_sendTx";
    readonly networkId: string;
    readonly tx: Tx;
};

export type AztecGetContractClassMetadataOperation = {
    readonly kind: "aztec_getContractClassMetadata";
    readonly networkId: string;
    readonly id: Fr;
    readonly includeArtifact?: boolean;
};

export type AztecGetContractMetadataOperation = {
    readonly kind: "aztec_getContractMetadata";
    readonly networkId: string;
    readonly address: AztecAddress;
};

export type AztecRegisterContractOperation = {
    readonly kind: "aztec_registerContract";
    readonly networkId: string;
    readonly contract: {
        readonly instance: ContractInstanceWithAddress;
        readonly artifact?: ContractArtifact;
    };
};

export type AztecRegisterContractClassOperation = {
    readonly kind: "aztec_registerContractClass";
    readonly networkId: string;
    readonly artifact: ContractArtifact;
};

export type AztecProveTxOperation = {
    readonly kind: "aztec_proveTx";
    readonly networkId: string;
    readonly txRequest: TxExecutionRequest;
    readonly privateExecutionResult?: PrivateExecutionResult;
};

export type AztecGetNodeInfoOperation = {
    readonly kind: "aztec_getNodeInfo";
    readonly networkId: string;
};

export type AztecGetPXEInfoOperation = {
    readonly kind: "aztec_getPXEInfo";
    readonly networkId: string;
};

export type AztecGetCurrentBaseFeesOperation = {
    readonly kind: "aztec_getCurrentBaseFees";
    readonly networkId: string;
};

export type AztecUpdateContractOperation = {
    readonly kind: "aztec_updateContract";
    readonly networkId: string;
    readonly contractAddress: AztecAddress;
    readonly artifact: ContractArtifact;
};

export type AztecRegisterSenderOperation = {
    readonly kind: "aztec_registerSender";
    readonly networkId: string;
    readonly address: AztecAddress;
};

export type AztecGetSendersOperation = {
    readonly kind: "aztec_getSenders";
    readonly networkId: string;
};

export type AztecRemoveSenderOperation = {
    readonly kind: "aztec_removeSender";
    readonly networkId: string;
    readonly address: AztecAddress;
};

export type AztecGetTxReceiptOperation = {
    readonly kind: "aztec_getTxReceipt";
    readonly networkId: string;
    readonly txHash: TxHash;
};

export type AztecGetPrivateEventsOperation = {
    readonly kind: "aztec_getPrivateEvents";
    readonly networkId: string;
    readonly contractAddress: AztecAddress;
    readonly eventMetadata: EventMetadataDefinition;
    readonly from: number;
    readonly numBlocks: number;
    recipients: AztecAddress[];
};

export type AztecGetPublicEventsOperation = {
    readonly kind: "aztec_getPublicEvents";
    readonly networkId: string;
    readonly eventMetadata: EventMetadataDefinition;
    readonly from: number;
    readonly limit: number;
};

// Aztec.js AccountInterface:

export type AztecGetCompleteAddressOperation = {
    readonly kind: "aztec_getCompleteAddress";
    readonly networkId: string;
    readonly accountAddress: string;
};

export type AztecGetAddressOperation = {
    readonly kind: "aztec_getAddress";
    readonly networkId: string;
    readonly accountAddress: string;
};

export type AztecGetChainIdOperation = {
    readonly kind: "aztec_getChainId";
    readonly networkId: string;
};

export type AztecGetVersionOperation = {
    readonly kind: "aztec_getVersion";
    readonly networkId: string;
};

// Aztec.js EntrypointInterface:

export type AztecCreateTxExecutionRequestOperation = {
    readonly kind: "aztec_createTxExecutionRequest";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly exec: ExecutionPayload;
    readonly fee: FeeOptionsDto;
    readonly options: TxExecutionOptions;
};

type FeeOptionsDto = {
    readonly paymentMethod: FeePaymentMethodDto;
    readonly gasSettings: GasSettings;
};

type FeePaymentMethodDto = {
    readonly asset?: AztecAddress;
    readonly executionPayload: ExecutionPayload;
    readonly feePayer: AztecAddress;
};

// Aztec.js AuthWitnessProvider:

export type AztecCreateAuthWitOperation = {
    readonly kind: "aztec_createAuthWit";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly messageHashOrIntent: Fr | IntentInnerHashDto | IntentActionDto;
};

type IntentInnerHashDto = {
    readonly consumer: AztecAddress;
    readonly innerHash: Fr;
};

type IntentActionDto = {
    readonly caller: AztecAddress;
    readonly action: FunctionCall;
};
