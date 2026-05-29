import type { Fr } from "@aztec/foundation/curves/bn254";
import type { SimulateTxOpts, ExecuteUtilityOpts, ProfileTxOpts, ProveTxOpts } from "@aztec/pxe/client/bundle";
import type { ContractArtifact, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CompleteAddress,
    type ContractInstanceWithAddress,
    type PartialAddress,
} from "@aztec/stdlib/contract";
import { NoteDao } from "@aztec/stdlib/note";
import type { NotesFilter } from "./spec";
import {
    TxExecutionRequest,
    TxProfileResult,
    TxProvingResult,
    TxSimulationResult,
    UtilityExecutionResult,
} from "@aztec/stdlib/tx";
import { Network } from "@/wallet/services/network/spec";
import { PxeServiceClient } from "./client";
import { PrivateEventFilter } from "@aztec/aztec.js/wallet";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";

export interface IPXE {
    getContractInstance(address: AztecAddress): Promise<ContractInstanceWithAddress | undefined>;
    getContractArtifact(id: Fr, options?: { fetchFromNode?: boolean }): Promise<ContractArtifact | undefined>;
    registerAccount(secretKey: Fr, partialAddress: PartialAddress): Promise<CompleteAddress>;
    registerSender(address: AztecAddress): Promise<AztecAddress>;
    getSenders(): Promise<AztecAddress[]>;
    removeSender(address: AztecAddress): Promise<void>;
    getRegisteredAccounts(): Promise<CompleteAddress[]>;
    registerContractClass(artifact: ContractArtifact): Promise<void>;
    registerContract(contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact }): Promise<void>;
    updateContract(contractAddress: AztecAddress, artifact: ContractArtifact): Promise<void>;
    getContracts(): Promise<AztecAddress[]>;
    getNotes(filter: NotesFilter): Promise<NoteDao[]>;
    proveTx(txRequest: TxExecutionRequest, opts: ProveTxOpts): Promise<TxProvingResult>;
    profileTx(txRequest: TxExecutionRequest, opts: ProfileTxOpts): Promise<TxProfileResult>;
    simulateTx(txRequest: TxExecutionRequest, opts: SimulateTxOpts): Promise<TxSimulationResult>;
    executeUtility(call: FunctionCall, opts: ExecuteUtilityOpts): Promise<UtilityExecutionResult>;
    getPrivateEvents<T>(eventSelector: EventSelector, filter: PrivateEventFilter): Promise<PackedPrivateEvent[]>;
}

export class PXEProxy implements IPXE {
    public constructor(private readonly pxeService: PxeServiceClient, private readonly network: Network) {}

    getContractInstance(address: AztecAddress): Promise<ContractInstanceWithAddress | undefined> {
        return this.pxeService.getContractInstance(this.network, address);
    }

    getContractArtifact(id: Fr, options?: { fetchFromNode?: boolean }): Promise<ContractArtifact | undefined> {
        return this.pxeService.getContractArtifact(this.network, id, options);
    }

    registerAccount(secretKey: Fr, partialAddress: PartialAddress): Promise<CompleteAddress> {
        return this.pxeService.registerAccount(this.network, secretKey, partialAddress);
    }

    registerSender(address: AztecAddress): Promise<AztecAddress> {
        return this.pxeService.registerSender(this.network, address);
    }

    getSenders(): Promise<AztecAddress[]> {
        return this.pxeService.getSenders(this.network);
    }

    removeSender(address: AztecAddress): Promise<void> {
        return this.pxeService.removeSender(this.network, address);
    }

    getRegisteredAccounts(): Promise<CompleteAddress[]> {
        return this.pxeService.getRegisteredAccounts(this.network);
    }

    registerContractClass(artifact: ContractArtifact): Promise<void> {
        return this.pxeService.registerContractClass(this.network, artifact);
    }

    registerContract(contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact }): Promise<void> {
        return this.pxeService.registerContract(this.network, contract);
    }

    updateContract(contractAddress: AztecAddress, artifact: ContractArtifact): Promise<void> {
        return this.pxeService.updateContract(this.network, contractAddress, artifact);
    }

    getContracts(): Promise<AztecAddress[]> {
        return this.pxeService.getContracts(this.network);
    }

    getNotes(filter: NotesFilter): Promise<NoteDao[]> {
        return this.pxeService.getNotes(this.network, filter);
    }

    proveTx(txRequest: TxExecutionRequest, opts: ProveTxOpts): Promise<TxProvingResult> {
        return this.pxeService.proveTx(this.network, txRequest, opts);
    }

    profileTx(txRequest: TxExecutionRequest, opts: ProfileTxOpts): Promise<TxProfileResult> {
        return this.pxeService.profileTx(this.network, txRequest, opts);
    }

    simulateTx(txRequest: TxExecutionRequest, opts: SimulateTxOpts): Promise<TxSimulationResult> {
        return this.pxeService.simulateTx(this.network, txRequest, opts);
    }

    executeUtility(call: FunctionCall, opts: ExecuteUtilityOpts): Promise<UtilityExecutionResult> {
        return this.pxeService.executeUtility(this.network, call, opts);
    }

    async getPrivateEvents<T>(eventSelector: EventSelector, filter: PrivateEventFilter): Promise<PackedPrivateEvent[]> {
        return this.pxeService.getPrivateEvents(this.network, eventSelector, filter);
    }
}
