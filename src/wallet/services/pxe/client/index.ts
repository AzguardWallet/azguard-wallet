import type { Fr } from "@aztec/foundation/fields";
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
import type { ContractClassMetadata, ContractMetadata, PXE, PXEInfo } from "@aztec/stdlib/interfaces/client";
import { type NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    type PrivateExecutionResult,
    type Tx,
    type TxExecutionRequest,
    TxHash,
    TxProvingResult,
    TxSimulationResult,
    UtilitySimulationResult,
    SimulationOverrides,
} from "@aztec/stdlib/tx";
import z from "zod";
import { ServiceClient } from "@/wallet/base/message-service/service-client";
import type { Network } from "@/wallet/services/network/client";
import { ensureOffscreenRunning } from "@/wallet/utils/offscreen";
import { ContractClassMetadataSchema, ContractMetadataSchema, PXEInfoSchema } from "@/wallet/utils/schemas";
import { PxeServiceMethod } from "./methods";
import { PXEProxy } from "./proxy";
import { DummyLogger } from "@/wallet/services/logger/client";

export * from "./methods";

export const PXE_SERVICE_NAME = "pxe";

export class PxeServiceClient extends ServiceClient<PxeServiceMethod, void> {
    public constructor(name?: string) {
        super(PXE_SERVICE_NAME, new DummyLogger(), name);
    }

    protected async onEvent() {}

    public getPXE(network: Network): PXE {
        return new PXEProxy(this, network);
    }

    public async getContractClassMetadata(
        network: Network,
        id: Fr,
        includeArtifact?: boolean,
    ): Promise<ContractClassMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetContractClassMetadata, { network, id, includeArtifact });
        return await ContractClassMetadataSchema.parseAsync(result);
    }

    public async getContractMetadata(network: Network, address: AztecAddress): Promise<ContractMetadata> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetContractMetadata, { network, address });
        return await ContractMetadataSchema.parseAsync(result);
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetContracts, { network });
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getCurrentBaseFees(network: Network): Promise<GasFees> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetCurrentBaseFees, { network });
        return await GasFees.schema.parseAsync(result);
    }

    public async getNodeInfo(network: Network): Promise<NodeInfo> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetNodeInfo, { network });
        return await NodeInfoSchema.parseAsync(result);
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<UniqueNote[]> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetNotes, { network, filter });
        return await z.array(UniqueNote.schema).parseAsync(result);
    }

    public async getPXEInfo(network: Network): Promise<PXEInfo> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetPXEInfo, { network });
        return await PXEInfoSchema.parseAsync(result);
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetSenders, { network });
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.GetRegisteredAccounts, { network });
        return await z.array(CompleteAddress.schema).parseAsync(result);
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        privateExecutionResult: PrivateExecutionResult,
    ): Promise<TxProvingResult> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.ProveTx, { network, txRequest, privateExecutionResult });
        return await TxProvingResult.schema.parseAsync(result);
    }

    public async registerAccount(
        network: Network,
        secretKey: Fr,
        partialAddress: PartialAddress,
    ): Promise<CompleteAddress> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.RegisterAccount, { network, secretKey, partialAddress });
        return await CompleteAddress.schema.parseAsync(result);
    }

    public async registerContract(
        network: Network,
        contract: {
            instance: ContractInstanceWithAddress;
            artifact?: ContractArtifact;
        },
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request(PxeServiceMethod.RegisterContract, { network, contract });
    }

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.RegisterSender, { network, address });
        return await AztecAddress.schema.parseAsync(result);
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        await ensureOffscreenRunning();
        await this.request(PxeServiceMethod.RemoveSender, { network, address });
    }

    public async sendTx(network: Network, tx: Tx): Promise<TxHash> {
        await ensureOffscreenRunning();
        const result = await this.request(PxeServiceMethod.SendTx, { network, tx });
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
        const result = await this.request(PxeServiceMethod.SimulateTx, {
            network,
            txRequest,
            simulatePublic,
            skipTxValidation,
            skipFeeEnforcement,
            overrides,
            scopes,
        });
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
        const result = await this.request(PxeServiceMethod.SimulateUtility, {
            network,
            functionName,
            args,
            to,
            authwits,
            from,
            scopes,
        });
        return await UtilitySimulationResult.schema.parseAsync(result);
    }

    public async updateContract(
        network: Network,
        address: AztecAddress,
        artifact: ContractArtifact,
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request(PxeServiceMethod.UpdateContract, {
            network,
            address,
            artifact
        });
    }
}
