import { L1_TO_L2_MSG_TREE_HEIGHT } from "@aztec/constants";
import type { Fr } from "@aztec/foundation/fields";
import { SiblingPath } from "@aztec/foundation/trees";
import { type AbiDecoded, type ContractArtifact } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CompleteAddress,
    type ContractInstanceWithAddress,
    type NodeInfo,
    type PartialAddress,
} from "@aztec/stdlib/contract";
import { L2Block } from "@aztec/stdlib/block";
import { GasFees } from "@aztec/stdlib/gas";
import {
    ContractClassMetadata,
    ContractMetadata,
    EventMetadataDefinition,
    GetContractClassLogsResponse,
    GetPublicLogsResponse,
    PXE,
    PXEInfo,
} from "@aztec/stdlib/interfaces/client";
import { LogFilter } from "@aztec/stdlib/logs";
import { NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    IndexedTxEffect,
    PrivateExecutionResult,
    Tx,
    TxExecutionRequest,
    TxHash,
    TxProfileResult,
    TxProvingResult,
    TxReceipt,
    TxSimulationResult,
} from "@aztec/stdlib/tx";
import { Network } from "@/wallet/services/network/client";
import { PxeServiceClient } from ".";

export class PXEProxy implements PXE {
    public constructor(
        private readonly pxeService: PxeServiceClient,
        private readonly network: Network,
    ) {}

    isL1ToL2MessageSynced(l1ToL2Message: Fr): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    registerAccount(secretKey: Fr, partialAddress: PartialAddress): Promise<CompleteAddress> {
        return this.pxeService.registerAccount(this.network, secretKey, partialAddress);
    }
    getRegisteredAccounts(): Promise<CompleteAddress[]> {
        return this.pxeService.getRegisteredAccounts(this.network);
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
    registerContractClass(artifact: ContractArtifact): Promise<void> {
        throw new Error("Method not implemented.");
    }
    registerContract(contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact }): Promise<void> {
        return this.pxeService.registerContract(this.network, contract);
    }
    updateContract(contractAddress: AztecAddress, artifact: ContractArtifact): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getContracts(): Promise<AztecAddress[]> {
        return this.pxeService.getContracts(this.network);
    }
    proveTx(txRequest: TxExecutionRequest, privateExecutionResult: PrivateExecutionResult): Promise<TxProvingResult> {
        return this.pxeService.proveTx(this.network, txRequest, privateExecutionResult);
    }
    simulateTx(
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        msgSender?: AztecAddress,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        scopes?: AztecAddress[],
    ): Promise<TxSimulationResult> {
        return this.pxeService.simulateTx(
            this.network,
            txRequest,
            simulatePublic,
            msgSender,
            skipTxValidation,
            skipFeeEnforcement,
            scopes,
        );
    }
    profileTx(
        txRequest: TxExecutionRequest,
        profileMode: "gates" | "execution-steps" | "full",
        msgSender?: AztecAddress,
    ): Promise<TxProfileResult> {
        throw new Error("Method not implemented.");
    }
    sendTx(tx: Tx): Promise<TxHash> {
        return this.pxeService.sendTx(this.network, tx);
    }
    getTxReceipt(txHash: TxHash): Promise<TxReceipt> {
        throw new Error("Method not implemented.");
    }
    getTxEffect(txHash: TxHash): Promise<IndexedTxEffect | undefined> {
        throw new Error("Method not implemented.");
    }
    getPublicStorageAt(contract: AztecAddress, slot: Fr): Promise<Fr> {
        throw new Error("Method not implemented.");
    }
    getNotes(filter: NotesFilter): Promise<UniqueNote[]> {
        return this.pxeService.getNotes(this.network, filter);
    }
    getL1ToL2MembershipWitness(
        contractAddress: AztecAddress,
        messageHash: Fr,
        secret: Fr,
    ): Promise<[bigint, SiblingPath<typeof L1_TO_L2_MSG_TREE_HEIGHT>]> {
        throw new Error("Method not implemented.");
    }
    getL2ToL1MembershipWitness(blockNumber: number, l2Tol1Message: Fr): Promise<[bigint, SiblingPath<number>]> {
        throw new Error("Method not implemented.");
    }
    getBlock(number: number): Promise<L2Block | undefined> {
        throw new Error("Method not implemented.");
    }
    getCurrentBaseFees(): Promise<GasFees> {
        return this.pxeService.getCurrentBaseFees(this.network);
    }
    simulateUtility(
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        from?: AztecAddress,
        scopes?: AztecAddress[],
    ): Promise<AbiDecoded> {
        return this.pxeService.simulateUtility(this.network, functionName, args, to, authwits, from, scopes);
    }
    getPublicLogs(filter: LogFilter): Promise<GetPublicLogsResponse> {
        throw new Error("Method not implemented.");
    }
    getContractClassLogs(filter: LogFilter): Promise<GetContractClassLogsResponse> {
        throw new Error("Method not implemented.");
    }
    getBlockNumber(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getProvenBlockNumber(): Promise<number> {
        throw new Error("Method not implemented.");
    }
    getNodeInfo(): Promise<NodeInfo> {
        return this.pxeService.getNodeInfo(this.network);
    }
    getPXEInfo(): Promise<PXEInfo> {
        return this.pxeService.getPXEInfo(this.network);
    }
    getContractMetadata(address: AztecAddress): Promise<ContractMetadata> {
        return this.pxeService.getContractMetadata(this.network, address);
    }
    getContractClassMetadata(id: Fr, includeArtifact?: boolean): Promise<ContractClassMetadata> {
        return this.pxeService.getContractClassMetadata(this.network, id, includeArtifact);
    }
    getPrivateEvents<T>(
        contractAddress: AztecAddress,
        eventMetadata: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<T[]> {
        throw new Error("Method not implemented.");
    }
    getPublicEvents<T>(eventMetadata: EventMetadataDefinition, from: number, limit: number): Promise<T[]> {
        throw new Error("Method not implemented.");
    }
}
