import type { CallIntent, IntentInnerHash } from "@aztec/aztec.js/authorization";
import type { InteractionWaitOptions } from "@aztec/aztec.js/contracts";
import type { PrivateEventFilter, ProfileOptions, SendOptions, SimulateOptions, SimulateUtilityOptions } from "@aztec/aztec.js/wallet";
import type { Fr } from "@aztec/foundation/curves/bn254";
import type { ContractArtifact, EventMetadataDefinition, FunctionCall } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import type { ExecutionPayload } from "@aztec/stdlib/tx";
import type { Action, CallAction, EncodedCallAction, FeeSettings } from ".";

export type OperationKind = Operation["kind"];

export type Operation =
    // Azguard interface:
    | GetCompleteAddressOperation
    | RegisterContractOperation
    | RegisterSenderOperation
    | RegisterTokenOperation
    | SendTransactionOperation
    | SimulateTransactionOperation
    | SimulateUtilityOperation
    | SimulateViewsOperation
    // Aztec.js interface:
    | AztecGetContractClassMetadataOperation
    | AztecGetContractMetadataOperation
    | AztecGetPrivateEventsOperation
    | AztecGetChainInfoOperation
    | AztecRegisterSenderOperation
    | AztecGetAddressBookOperation
    | AztecRegisterContractOperation
    | AztecSimulateTxOperation
    | AztecSimulateUtilityOperation
    | AztecProfileTxOperation
    | AztecGetAccountsOperation
    | AztecSendTxOperation
    | AztecCreateAuthWitOperation;

// Azguard interface:

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

export type FeeOptions = {
    readonly embeddedFeePayment?: "fjwc" | "fpc";
    readonly gasLimits?: GasLimits;
    readonly teardownGasLimits?: GasLimits;
    readonly gasPadding?: number;
};

export type GasLimits = {
    readonly daGas: number;
    readonly l2Gas: number;
};

export type SendTransactionOperation = {
    readonly kind: "send_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    feeSettings: FeeSettings;
    readonly actions: Action[];
    readonly fee?: FeeOptions;
};

export type SimulateTransactionOperation = {
    readonly kind: "simulate_transaction";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly actions: Action[];
    readonly fee?: FeeOptions;
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

// Aztec.js interface:

export type AztecGetContractClassMetadataOperation = {
    readonly kind: "aztec_getContractClassMetadata";
    readonly networkId: string;
    readonly id: Fr;
};

export type AztecGetContractMetadataOperation = {
    readonly kind: "aztec_getContractMetadata";
    readonly networkId: string;
    readonly address: AztecAddress;
};

export type AztecGetPrivateEventsOperation = {
    readonly kind: "aztec_getPrivateEvents";
    readonly networkId: string;
    readonly eventMetadata: EventMetadataDefinition;
    readonly eventFilter: PrivateEventFilter;
};

export type AztecGetChainInfoOperation = {
    readonly kind: "aztec_getChainInfo";
    readonly networkId: string;
};

export type AztecRegisterSenderOperation = {
    readonly kind: "aztec_registerSender";
    readonly networkId: string;
    readonly address: AztecAddress;
    readonly alias?: string;
};

export type AztecGetAddressBookOperation = {
    readonly kind: "aztec_getAddressBook";
    readonly networkId: string;
};

export type AztecGetAccountsOperation = {
    readonly kind: "aztec_getAccounts";
    readonly networkId: string;
    readonly accounts: string[];
};

export type AztecRegisterContractOperation = {
    readonly kind: "aztec_registerContract";
    readonly networkId: string;
    readonly instance: ContractInstanceWithAddress;
    readonly artifact?: ContractArtifact;
    readonly secretKey?: Fr;
};

export type AztecSimulateTxOperation = {
    readonly kind: "aztec_simulateTx";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly exec: ExecutionPayload;
    readonly opts: SimulateOptions;
};

export type AztecSimulateUtilityOperation = {
    readonly kind: "aztec_simulateUtility";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly call: FunctionCall;
    readonly opts: SimulateUtilityOptions;
};

export type AztecProfileTxOperation = {
    readonly kind: "aztec_profileTx";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly exec: ExecutionPayload;
    readonly opts: ProfileOptions;
};

export type AztecSendTxOperation = {
    readonly kind: "aztec_sendTx";
    readonly networkId: string;
    readonly accountAddress: string;
    feeSettings: FeeSettings;
    readonly exec: ExecutionPayload;
    readonly opts: SendOptions<InteractionWaitOptions>;
};

export type AztecCreateAuthWitOperation = {
    readonly kind: "aztec_createAuthWit";
    readonly networkId: string;
    readonly accountAddress: string;
    readonly messageHashOrIntent: IntentInnerHash | CallIntent;
};
