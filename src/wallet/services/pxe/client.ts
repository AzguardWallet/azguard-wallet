import { Fr } from "@aztec/foundation/fields";
import type { ContractArtifact, EventMetadataDefinition } from "@aztec/stdlib/abi";
import type { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    ContractClassMetadata,
    ContractMetadata,
    CompleteAddress,
    type ContractInstanceWithAddress,
    type PartialAddress,
    ContractInstanceWithAddressSchema,
} from "@aztec/stdlib/contract";
import { type NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    SimulationOverrides,
    type TxExecutionRequest,
    TxProfileResult,
    TxProvingResult,
    TxSimulationResult,
    UtilitySimulationResult,
} from "@aztec/stdlib/tx";
import z from "zod";
import { ILogger } from "@/wallet/logger";
import { ServiceSpec } from "@/wallet/base";
import { Network } from "@/wallet/services/network/service";
import { ServiceClient } from "@/wallet/base/offscreen";
import { ensureOffscreenRunning } from "@/wallet/utils/offscreen";
import { ContractClassMetadataSchema, ContractMetadataSchema } from "@/wallet/utils/schemas";
import { Methods, PXE_SERVICE_NAME } from "./spec";
import { IPXE, PXEProxy } from "./proxy";

export * from "./proxy";
export * from "./spec";

export class PxeServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(logger: ILogger) {
        super(PXE_SERVICE_NAME, logger);
    }

    public getPXE(network: Network): IPXE {
        return new PXEProxy(this, network);
    }

    public async getContractInstance(
        network: Network,
        address: AztecAddress,
    ): Promise<ContractInstanceWithAddress | undefined> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractInstance", network, address);
        return await ContractInstanceWithAddressSchema.optional().parseAsync(result);
    }

    public async getContractClassMetadata(
        network: Network,
        id: Fr,
        includeArtifact?: boolean,
    ): Promise<ContractClassMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractClassMetadata", network, id, includeArtifact);
        return await ContractClassMetadataSchema.parseAsync(result);
    }

    public async getContractMetadata(network: Network, address: AztecAddress): Promise<ContractMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractMetadata", network, address);
        return await ContractMetadataSchema.parseAsync(result);
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

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        await ensureOffscreenRunning();
        const result = await this.request("registerSender", network, address);
        return await AztecAddress.schema.parseAsync(result);
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getSenders", network);
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("removeSender", network, address);
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getRegisteredAccounts", network);
        return await z.array(CompleteAddress.schema).parseAsync(result);
    }

    public async registerContractClass(network: Network, artifact: ContractArtifact): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("registerContractClass", network, artifact);
    }

    public async registerContract(
        network: Network,
        contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact },
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("registerContract", network, contract);
    }

    public async updateContract(
        network: Network,
        contractAddress: AztecAddress,
        artifact: ContractArtifact,
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("updateContract", network, contractAddress, artifact);
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getContracts", network);
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<UniqueNote[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getNotes", network, filter);
        return await z.array(UniqueNote.schema).parseAsync(result);
    }

    public async proveTx(network: Network, txRequest: TxExecutionRequest): Promise<TxProvingResult> {
        await ensureOffscreenRunning();
        const result = await this.request("proveTx", network, txRequest);
        return await TxProvingResult.schema.parseAsync(result);
    }

    public async profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        profileMode: "full" | "execution-steps" | "gates",
        skipProofGeneration?: boolean,
    ): Promise<TxProfileResult> {
        await ensureOffscreenRunning();
        const result = await this.request("profileTx", network, txRequest, profileMode, skipProofGeneration);
        return await TxProfileResult.schema.parseAsync(result);
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

    public async getPrivateEvents(
        network: Network,
        contractAddress: AztecAddress,
        eventMetadataDef: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<unknown[]> {
        await ensureOffscreenRunning();
        const result = await this.request(
            "getPrivateEvents",
            network,
            contractAddress,
            eventMetadataDef,
            from,
            numBlocks,
            recipients,
        );
        return result;
    }
}
