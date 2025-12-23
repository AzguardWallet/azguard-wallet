import { PrivateEventFilter } from "@aztec/aztec.js/wallet";
import type { Fr } from "@aztec/foundation/curves/bn254";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";
import type { ContractArtifact, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type {
    CompleteAddress,
    ContractClassMetadata,
    ContractInstanceWithAddress,
    ContractMetadata,
    PartialAddress,
} from "@aztec/stdlib/contract";
import type { NotesFilter, NoteDao } from "@aztec/stdlib/note";
import type {
    SimulationOverrides,
    TxExecutionRequest,
    TxProfileResult,
    TxProvingResult,
    TxSimulationResult,
    UtilitySimulationResult,
} from "@aztec/stdlib/tx";
import type { Network } from "@/wallet/services/network/spec";

export const PXE_SERVICE_NAME = "pxe";

export type Methods = {
    getContractInstance(network: Network, address: AztecAddress): ContractInstanceWithAddress | undefined;
    getContractClassMetadata(network: Network, id: Fr, includeArtifact?: boolean): ContractClassMetadata;
    getContractMetadata(network: Network, address: AztecAddress): ContractMetadata;
    registerAccount(network: Network, secretKey: Fr, partialAddress: PartialAddress): CompleteAddress;
    registerSender(network: Network, address: AztecAddress): AztecAddress;
    getSenders(network: Network): AztecAddress[];
    removeSender(network: Network, address: AztecAddress): void;
    getRegisteredAccounts(network: Network): CompleteAddress[];
    registerContractClass(network: Network, artifact: ContractArtifact): void;
    registerContract(
        network: Network,
        contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact },
    ): void;
    updateContract(network: Network, contractAddress: AztecAddress, artifact: ContractArtifact): void;
    getContracts(network: Network): AztecAddress[];
    getNotes(network: Network, filter: NotesFilter): NoteDao[];
    proveTx(network: Network, txRequest: TxExecutionRequest): TxProvingResult;
    profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        profileMode: "full" | "execution-steps" | "gates",
        skipProofGeneration?: boolean,
    ): TxProfileResult;
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
        call: FunctionCall,
        authwits?: AuthWitness[],
        scopes?: AztecAddress[],
    ): UtilitySimulationResult;
    getPrivateEvents<T>(
        network: Network,
        eventSelector: EventSelector,
        filter: PrivateEventFilter,
    ): PackedPrivateEvent[];
};
