import type { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact, EventMetadataDefinition } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CompleteAddress,
    type ContractInstanceWithAddress,
    type PartialAddress,
    ContractClassMetadata,
    ContractMetadata,
} from "@aztec/stdlib/contract";
import { NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    SimulationOverrides,
    TxExecutionRequest,
    TxProfileResult,
    TxProvingResult,
    TxSimulationResult,
    UtilitySimulationResult,
} from "@aztec/stdlib/tx";
import { Network } from "@/wallet/services/network/spec";
import { PxeServiceClient } from "./client";

export interface IPXE {
    getContractInstance(address: AztecAddress): Promise<ContractInstanceWithAddress | undefined>;
    getContractClassMetadata(id: Fr, includeArtifact?: boolean): Promise<ContractClassMetadata>;
    getContractMetadata(address: AztecAddress): Promise<ContractMetadata>;
    registerAccount(secretKey: Fr, partialAddress: PartialAddress): Promise<CompleteAddress>;
    registerSender(address: AztecAddress): Promise<AztecAddress>;
    getSenders(): Promise<AztecAddress[]>;
    removeSender(address: AztecAddress): Promise<void>;
    getRegisteredAccounts(): Promise<CompleteAddress[]>;
    registerContractClass(artifact: ContractArtifact): Promise<void>;
    registerContract(contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact }): Promise<void>;
    updateContract(contractAddress: AztecAddress, artifact: ContractArtifact): Promise<void>;
    getContracts(): Promise<AztecAddress[]>;
    getNotes(filter: NotesFilter): Promise<UniqueNote[]>;
    proveTx(txRequest: TxExecutionRequest): Promise<TxProvingResult>;
    profileTx(
        txRequest: TxExecutionRequest,
        profileMode: "full" | "execution-steps" | "gates",
        skipProofGeneration?: boolean,
    ): Promise<TxProfileResult>;
    simulateTx(
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        overrides?: SimulationOverrides,
        scopes?: AztecAddress[],
    ): Promise<TxSimulationResult>;
    simulateUtility(
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        _from?: AztecAddress,
        scopes?: AztecAddress[],
    ): Promise<UtilitySimulationResult>;
    getPrivateEvents<T>(
        contractAddress: AztecAddress,
        eventMetadataDef: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<T[]>;
}

export class PXEProxy implements IPXE {
    public constructor(private readonly pxeService: PxeServiceClient, private readonly network: Network) {}

    getContractInstance(address: AztecAddress): Promise<ContractInstanceWithAddress | undefined> {
        return this.pxeService.getContractInstance(this.network, address);
    }

    getContractClassMetadata(id: Fr, includeArtifact?: boolean): Promise<ContractClassMetadata> {
        return this.pxeService.getContractClassMetadata(this.network, id, includeArtifact);
    }

    getContractMetadata(address: AztecAddress): Promise<ContractMetadata> {
        return this.pxeService.getContractMetadata(this.network, address);
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

    getNotes(filter: NotesFilter): Promise<UniqueNote[]> {
        return this.pxeService.getNotes(this.network, filter);
    }

    proveTx(txRequest: TxExecutionRequest): Promise<TxProvingResult> {
        return this.pxeService.proveTx(this.network, txRequest);
    }

    profileTx(
        txRequest: TxExecutionRequest,
        profileMode: "full" | "execution-steps" | "gates",
        skipProofGeneration?: boolean,
    ): Promise<TxProfileResult> {
        return this.pxeService.profileTx(this.network, txRequest, profileMode, skipProofGeneration);
    }

    simulateTx(
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        overrides?: SimulationOverrides,
        scopes?: AztecAddress[],
    ): Promise<TxSimulationResult> {
        return this.pxeService.simulateTx(
            this.network,
            txRequest,
            simulatePublic,
            skipTxValidation,
            skipFeeEnforcement,
            overrides,
            scopes,
        );
    }

    simulateUtility(
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        from?: AztecAddress,
        scopes?: AztecAddress[],
    ): Promise<UtilitySimulationResult> {
        return this.pxeService.simulateUtility(this.network, functionName, args, to, authwits, from, scopes);
    }

    async getPrivateEvents<T>(
        contractAddress: AztecAddress,
        eventMetadataDef: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<T[]> {
        return (await this.pxeService.getPrivateEvents(
            this.network,
            contractAddress,
            eventMetadataDef,
            from,
            numBlocks,
            recipients,
        )) as T[];
    }
}
