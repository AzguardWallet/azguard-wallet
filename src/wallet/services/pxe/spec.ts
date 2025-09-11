import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type { CompleteAddress, ContractInstanceWithAddress, NodeInfo, PartialAddress } from "@aztec/stdlib/contract";
import type { NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import type {
    PrivateExecutionResult,
    SimulationOverrides,
    Tx,
    TxExecutionRequest,
    TxHash,
    TxProfileResult,
    TxProvingResult,
    TxReceipt,
    TxSimulationResult,
    UtilitySimulationResult,
} from "@aztec/stdlib/tx";
import type { Network } from "@/wallet/services/network/spec";
import type { GasFees } from "@aztec/stdlib/gas";
import type {
    ContractClassMetadata,
    ContractMetadata,
    EventMetadataDefinition,
    PXEInfo,
} from "@aztec/stdlib/interfaces/client";

export const PXE_SERVICE_NAME = "pxe";

export type Methods = {
    getContractClassMetadata(network: Network, id: Fr): ContractClassMetadata;
    getContractMetadata(network: Network, address: AztecAddress): ContractMetadata;
    getContracts(network: Network): AztecAddress[];
    getCurrentBaseFees(network: Network): GasFees;
    getNodeInfo(network: Network): NodeInfo;
    getNotes(network: Network, filter: NotesFilter): UniqueNote[];
    getPXEInfo(network: Network): PXEInfo;
    getPublicStorageAt(network: Network, contract: AztecAddress, slot: Fr): Fr;
    getSenders(network: Network): AztecAddress[];
    getRegisteredAccounts(network: Network): CompleteAddress[];
    proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        privateExecutionResult: PrivateExecutionResult,
    ): TxProvingResult;
    registerAccount(network: Network, secretKey: Fr, partialAddress: PartialAddress): CompleteAddress;
    registerContract(network: Network, instance: ContractInstanceWithAddress, artifact?: ContractArtifact): void;
    registerSender(network: Network, address: AztecAddress): AztecAddress;
    removeSender(network: Network, address: AztecAddress): void;
    sendTx(network: Network, tx: Tx): TxHash;
    simulateTx(
        network: Network,
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        overrides?: SimulationOverrides,
        scopes?: AztecAddress[],
    ): TxSimulationResult;
    simulateUtility(
        network: Network,
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        from?: AztecAddress,
        scopes?: AztecAddress[],
    ): UtilitySimulationResult;
    updateContract(network: Network, contractAddress: AztecAddress, artifact: ContractArtifact): void;
    registerContractClass(network: Network, artifact: ContractArtifact): void;
    getTxReceipt(network: Network, txHash: TxHash): TxReceipt;
    getPrivateEvents(
        network: Network,
        contractAddress: AztecAddress,
        eventMetadata: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): unknown[];
    getPublicEvents(network: Network, eventMetadata: EventMetadataDefinition, from: number, limit: number): unknown[];
    profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        profileMode: "gates" | "execution-steps" | "full",
        skipProofGeneration?: boolean,
        msgSender?: AztecAddress,
    ): TxProfileResult;
};
