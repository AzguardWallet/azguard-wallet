import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { ContractInstanceWithAddress, PartialAddress } from "@aztec/stdlib/contract";
import type { NotesFilter } from "@aztec/stdlib/note";
import type { PrivateExecutionResult, Tx, TxExecutionRequest } from "@aztec/stdlib/tx";
import type { Network } from "@/wallet/services/network/client";

export enum PxeServiceMethod {
    GetContractClassMetadata = 1,
    GetContractMetadata = 2,
    GetContracts = 3,
    GetCurrentBaseFees = 4,
    GetNodeInfo = 5,
    GetNotes = 6,
    GetPXEInfo = 7,
    GetSenders = 8,
    GetRegisteredAccounts = 9,
    ProveTx = 10,
    RegisterAccount = 11,
    RegisterContract = 12,
    RegisterSender = 13,
    RemoveSender = 14,
    SendTx = 15,
    SimulateTx = 16,
    SimulateUtility = 17,
    UpdateContract = 18,
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
    msgSender?: AztecAddress;
    skipTxValidation?: boolean;
    skipFeeEnforcement?: boolean;
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
