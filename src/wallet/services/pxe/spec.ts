import { PrivateEventFilter } from "@aztec/aztec.js/wallet";
import type { Fr } from "@aztec/foundation/curves/bn254";
import { PackedPrivateEvent, type NotesFilter } from "@aztec/pxe/client/bundle";
export type { NotesFilter };
import type { SimulateTxOpts, SimulateUtilityOpts, ProfileTxOpts } from "@aztec/pxe/client/bundle";
import type { ContractArtifact, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
import type { AztecAddress } from "@aztec/stdlib/aztec-address";
import type {
    CompleteAddress,
    ContractInstanceWithAddress,
    PartialAddress,
} from "@aztec/stdlib/contract";
import type { NoteDao } from "@aztec/stdlib/note";
import type {
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
    getContractArtifact(network: Network, id: Fr): ContractArtifact | undefined;
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
    proveTx(network: Network, txRequest: TxExecutionRequest, scopes: AztecAddress[]): TxProvingResult;
    profileTx(network: Network, txRequest: TxExecutionRequest, opts: ProfileTxOpts): TxProfileResult;
    simulateTx(network: Network, txRequest: TxExecutionRequest, opts: SimulateTxOpts): TxSimulationResult;
    simulateUtility(network: Network, call: FunctionCall, opts: SimulateUtilityOpts): UtilitySimulationResult;
    getPrivateEvents<T>(
        network: Network,
        eventSelector: EventSelector,
        filter: PrivateEventFilter,
    ): PackedPrivateEvent[];
};
