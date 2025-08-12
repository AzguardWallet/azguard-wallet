import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { ContractInstanceWithAddress, PartialAddress } from "@aztec/stdlib/contract";
import type { NotesFilter } from "@aztec/stdlib/note";
import type { PrivateExecutionResult, SimulationOverrides, Tx, TxExecutionRequest } from "@aztec/stdlib/tx";
import type { Network } from "@/wallet/services/network/client";

export enum PxeServiceMethod {
    GetContractClassMetadata = 1,
    GetContractMetadata = 2,
    GetContracts = 3,
    GetCurrentBaseFees = 4,
    GetNodeInfo = 5,
    GetNotes = 6,
    GetPXEInfo = 7,
    GetPublicStorageAt = 8,
    GetSenders = 9,
    GetRegisteredAccounts = 10,
    ProveTx = 11,
    RegisterAccount = 12,
    RegisterContract = 13,
    RegisterSender = 14,
    RemoveSender = 15,
    SendTx = 16,
    SimulateTx = 17,
    SimulateUtility = 18,
    UpdateContract = 19,
}

type BaseParams = {
    network: Network;
};

export type GetContractClassMetadataParams = BaseParams & {
    id: Fr;
    includeArtifact?: boolean;
};

export type GetContractMetadataParams = BaseParams & {
    address: AztecAddress;
};

export type GetContractsParams = BaseParams;

export type GetCurrentBaseFeesParams = BaseParams;

export type GetNodeInfoParams = BaseParams;

export type GetNotesParams = BaseParams & {
    filter: NotesFilter;
};

export type GetPXEInfoParams = BaseParams;

export type GetPublicStorageAtParams = BaseParams & {
    contract: AztecAddress;
    slot: Fr;
};

export type GetSendersParams = BaseParams;

export type GetRegisteredAccountsParams = BaseParams;

export type ProveTxParams = BaseParams & {
    txRequest: TxExecutionRequest;
    privateExecutionResult: PrivateExecutionResult;
};

export type RegisterAccountParams = BaseParams & {
    secretKey: Fr;
    partialAddress: PartialAddress;
};

export type RegisterContractParams = BaseParams & {
    contract: {
        instance: ContractInstanceWithAddress;
        artifact?: ContractArtifact;
    };
};

export type RegisterSenderParams = BaseParams & {
    address: AztecAddress;
};

export type RemoveSenderParams = BaseParams & {
    address: AztecAddress;
};

export type SendTxParams = BaseParams & {
    tx: Tx;
};

export type SimulateTxParams = BaseParams & {
    txRequest: TxExecutionRequest;
    simulatePublic: boolean;
    skipTxValidation?: boolean;
    skipFeeEnforcement?: boolean;
    overrides?: SimulationOverrides,
    scopes?: AztecAddress[];
};

export type SimulateUtilityParams = BaseParams & {
    functionName: string;
    args: any[];
    to: AztecAddress;
    authwits?: AuthWitness[];
    from?: AztecAddress;
    scopes?: AztecAddress[];
};

export type UpdateContractParams = BaseParams & {
    address: AztecAddress;
    artifact: ContractArtifact;
};
