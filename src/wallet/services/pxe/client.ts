import { Fr } from "@aztec/foundation/curves/bn254";
import type { SimulateTxOpts, ExecuteUtilityOpts, ProfileTxOpts, ProveTxOpts } from "@aztec/pxe/client/bundle";
import type { ContractArtifact, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
import { ContractArtifactSchema } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CompleteAddress,
    type ContractInstancePreimageWithAddress,
    type PartialAddress,
    ContractInstancePreimageWithAddressSchema,
} from "@aztec/stdlib/contract";
import { NoteDao } from "@aztec/stdlib/note";
import type { NotesFilter } from "./spec";
import {
    type TxExecutionRequest,
    TxProfileResult,
    TxProvingResult,
    TxSimulationResult,
    UtilityExecutionResult,
} from "@aztec/stdlib/tx";
import { PrivateEventFilter } from "@aztec/aztec.js/wallet";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";
import z from "zod";
import { ILogger } from "@/wallet/logger";
import { ServiceSpec } from "@/wallet/base";
import { Network } from "@/wallet/services/network/service";
import { ServiceClient } from "@/wallet/base/offscreen";
import { ensureOffscreenRunning } from "@/wallet/utils/offscreen";
import {
    NoteDaoSchema,
    PackedPrivateEventSchema,
} from "@/wallet/utils/schemas";
import { Methods, PXE_SERVICE_NAME } from "./spec";
import { IPXE, PXEProxy } from "./proxy";

export * from "./proxy";
export * from "./spec";

export class PxeServiceClient extends ServiceClient<Methods> implements ServiceSpec<Methods> {
    public constructor(logger: ILogger) {
        super(PXE_SERVICE_NAME, logger);
    }

    /**
     * Returns an `IPXE` for the given network — a `PXEProxy` around the raw `@aztec/pxe`
     * PXE. The proxy differs from a raw PXE in two ways:
     *   - it bridges the service-worker ↔ offscreen boundary (the raw PXE lives in the
     *     offscreen document and is reached via message passing);
     *   - `getContractInstance` and `getContractArtifact` extend the raw lookup with
     *     fallbacks to the Aztec node, bundled known artifacts/instances, and the
     *     on-chain contract registry.
     */
    public getPXE(network: Network): IPXE {
        return new PXEProxy(this, network);
    }

    public async getContractInstance(
        network: Network,
        address: AztecAddress,
        options?: { fetchFromNode?: boolean },
    ): Promise<ContractInstancePreimageWithAddress | undefined> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractInstance", network, address, options);
        return await ContractInstancePreimageWithAddressSchema.optional().parseAsync(result);
    }

    public async getContractArtifact(
        network: Network,
        id: Fr,
        options?: { fetchFromNode?: boolean },
    ): Promise<ContractArtifact | undefined> {
        await ensureOffscreenRunning();
        const result = await this.request("getContractArtifact", network, id, options);
        return await ContractArtifactSchema.optional().parseAsync(result);
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

    public async ensureContractRegistered(
        network: Network,
        contract: { instance: ContractInstancePreimageWithAddress; artifact?: ContractArtifact },
    ): Promise<void> {
        await ensureOffscreenRunning();
        await this.request("ensureContractRegistered", network, contract);
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getContracts", network);
        return await z.array(AztecAddress.schema).parseAsync(result);
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<NoteDao[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getNotes", network, filter);
        // Schema rehydrates data fields (Fr, AztecAddress, etc.) after JSON round-trip from offscreen,
        // but produces plain objects, not NoteDao class instances. Cast is safe because consumers
        // (NoteService) only access data properties, never class methods like toBuffer/equals.
        return await z.array(NoteDaoSchema).parseAsync(result) as unknown as NoteDao[];
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: ProveTxOpts,
    ): Promise<TxProvingResult> {
        await ensureOffscreenRunning();
        const result = await this.request("proveTx", network, txRequest, opts);
        return await TxProvingResult.schema.parseAsync(result);
    }

    public async profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: ProfileTxOpts,
    ): Promise<TxProfileResult> {
        await ensureOffscreenRunning();
        const result = await this.request("profileTx", network, txRequest, opts);
        return await TxProfileResult.schema.parseAsync(result);
    }

    public async simulateTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: SimulateTxOpts,
    ): Promise<TxSimulationResult> {
        await ensureOffscreenRunning();
        const result = await this.request("simulateTx", network, txRequest, opts);
        return await TxSimulationResult.schema.parseAsync(result);
    }

    public async executeUtility(
        network: Network,
        call: FunctionCall,
        opts: ExecuteUtilityOpts,
    ): Promise<UtilityExecutionResult> {
        await ensureOffscreenRunning();
        const result = await this.request("executeUtility", network, call, opts);
        return await UtilityExecutionResult.schema.parseAsync(result);
    }

    public async getPrivateEvents(
        network: Network,
        eventSelector: EventSelector,
        filter: PrivateEventFilter,
    ): Promise<PackedPrivateEvent[]> {
        await ensureOffscreenRunning();
        const result = await this.request("getPrivateEvents", network, eventSelector, filter);
        return await z.array(PackedPrivateEventSchema).parseAsync(result);
    }
}
