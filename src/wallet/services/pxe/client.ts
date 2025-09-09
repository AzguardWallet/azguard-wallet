import { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CompleteAddress,
    NodeInfoSchema,
    type ContractInstanceWithAddress,
    type NodeInfo,
    type PartialAddress,
} from "@aztec/stdlib/contract";
import { GasFees } from "@aztec/stdlib/gas";
import type {
    ContractClassMetadata,
    ContractMetadata,
    EventMetadataDefinition,
    PXE,
    PXEInfo,
} from "@aztec/stdlib/interfaces/client";
import { type NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    type PrivateExecutionResult,
    SimulationOverrides,
    type Tx,
    type TxExecutionRequest,
    TxHash,
    TxProfileResult,
    TxProvingResult,
    TxReceipt,
    TxSimulationResult,
    UtilitySimulationResult,
} from "@aztec/stdlib/tx";
import z from "zod";
import { ILogger } from "@/wallet/logger";
import { ServiceSpec } from "@/wallet/base";
import { Network } from "@/wallet/services/network/service";
import { ServiceClient } from "@/wallet/base/offscreen";
import { ensureOffscreenRunning } from "@/wallet/utils/offscreen";
import { ContractClassMetadataSchema, ContractMetadataSchema, PXEInfoSchema } from "@/wallet/utils/schemas";
import { Methods, PXE_SERVICE_NAME } from "./spec";
import { PXEProxy } from "./proxy";

export * from "./proxy";
export * from "./spec";

export class PxeServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(logger: ILogger) {
        super(PXE_SERVICE_NAME, logger);
    }

    public getPXE(network: Network): PXE {
        return new PXEProxy(this, network);
    }

    public async getContractClassMetadata(network: Network, id: Fr): Promise<ContractClassMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractClassMetadata", network, id);
        return await ContractClassMetadataSchema.parseAsync(result);
    }

    public async getContractMetadata(network: Network, address: AztecAddress): Promise<ContractMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractMetadata", network, address);
        return await ContractMetadataSchema.parseAsync(result);
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getContracts", network);
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getCurrentBaseFees(network: Network): Promise<GasFees> {
        await ensureOffscreenRunning();
        const result = await this.request("getCurrentBaseFees", network);
        return await GasFees.schema.parseAsync(result);
    }

    public async getNodeInfo(network: Network): Promise<NodeInfo> {
        await ensureOffscreenRunning();
        const result = await this.request("getNodeInfo", network);
        return await NodeInfoSchema.parseAsync(result);
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<UniqueNote[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getNotes", network, filter);
        return await z.array(UniqueNote.schema).parseAsync(result);
    }

    public async getPXEInfo(network: Network): Promise<PXEInfo> {
        await ensureOffscreenRunning();
        const result = await this.request("getPXEInfo", network);
        return await PXEInfoSchema.parseAsync(result);
    }

    public async getPublicStorageAt(network: Network, contract: AztecAddress, slot: Fr): Promise<Fr> {
        await ensureOffscreenRunning();
        const result = await this.request("getPublicStorageAt", network, contract, slot);
        return await Fr.schema.parseAsync(result);
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getSenders", network);
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getRegisteredAccounts", network);
        return await z.array(CompleteAddress.schema).parseAsync(result);
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        privateExecutionResult: PrivateExecutionResult,
    ): Promise<TxProvingResult> {
        await ensureOffscreenRunning();
        const result = await this.request("proveTx", network, txRequest, privateExecutionResult);
        return await TxProvingResult.schema.parseAsync(result);
    }

    public async registerAccount(
        network: Network,
        secretKey: Fr,
        partialAddress: PartialAddress,
    ): Promise<CompleteAddress> {
        await ensureOffscreenRunning();
        const result = await this.request("registerAccount", network, secretKey, partialAddress);
        return await CompleteAddress.schema.parseAsync(result);
    }

    public async registerContract(
        network: Network,
        instance: ContractInstanceWithAddress,
        artifact?: ContractArtifact,
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("registerContract", network, instance, artifact);
    }

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        await ensureOffscreenRunning();
        const result = await this.request("registerSender", network, address);
        return await AztecAddress.schema.parseAsync(result);
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("removeSender", network, address);
    }

    public async sendTx(network: Network, tx: Tx): Promise<TxHash> {
        await ensureOffscreenRunning();
        const result = await this.request("sendTx", network, tx);
        return await TxHash.schema.parseAsync(result);
    }

    public async simulateTx(
        network: Network,
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        overrides?: SimulationOverrides,
        scopes?: AztecAddress[],
    ): Promise<TxSimulationResult> {
        await ensureOffscreenRunning();
        const result = await this.request(
            "simulateTx",
            network,
            txRequest,
            simulatePublic,
            skipTxValidation,
            skipFeeEnforcement,
            overrides,
            scopes,
        );
        return await TxSimulationResult.schema.parseAsync(result);
    }

    public async simulateUtility(
        network: Network,
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        from?: AztecAddress,
        scopes?: AztecAddress[],
    ): Promise<UtilitySimulationResult> {
        await ensureOffscreenRunning();
        const result = await this.request("simulateUtility", network, functionName, args, to, authwits, from, scopes);
        return await UtilitySimulationResult.schema.parseAsync(result);
    }

    public async updateContract(
        network: Network,
        contractAddress: AztecAddress,
        artifact: ContractArtifact,
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("updateContract", network, contractAddress, artifact);
    }

    public async registerContractClass(network: Network, artifact: ContractArtifact): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("registerContractClass", network, artifact);
    }

    public async getTxReceipt(network: Network, txHash: TxHash): Promise<TxReceipt> {
        await ensureOffscreenRunning();
        const result = await this.request("getTxReceipt", network, txHash);
        return await TxReceipt.schema.parseAsync(result);
    }

    public async getPrivateEvents(
        network: Network,
        contractAddress: AztecAddress,
        eventMetadata: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<unknown[]> {
        await ensureOffscreenRunning();
        const result = await this.request(
            "getPrivateEvents",
            network,
            contractAddress,
            eventMetadata,
            from,
            numBlocks,
            recipients,
        );
        return result;
    }

    public async getPublicEvents(
        network: Network,
        eventMetadata: EventMetadataDefinition,
        from: number,
        limit: number,
    ): Promise<unknown[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getPublicEvents", network, eventMetadata, from, limit);
        return result;
    }

    public async profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        profileMode: "gates" | "execution-steps" | "full",
        skipProofGeneration?: boolean,
        msgSender?: AztecAddress,
    ): Promise<TxProfileResult> {
        await ensureOffscreenRunning();
        const result = await this.request("profileTx", network, txRequest, profileMode, skipProofGeneration, msgSender);
        return await TxProfileResult.schema.parseAsync(result);
    }
}
