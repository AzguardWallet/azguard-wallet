import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { getPXEServiceConfig, type PXEServiceConfig } from "@aztec/pxe/config";
import { createPXEService } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/fields";
import { AuthRegistryContractArtifact } from "@aztec/noir-contracts.js/AuthRegistry";
import { ContractInstanceDeployerContractArtifact } from "@aztec/noir-contracts.js/ContractInstanceDeployer";
import { ContractClassRegistererContractArtifact } from "@aztec/noir-contracts.js/ContractClassRegisterer";
import { EasyPrivateTokenContractArtifact } from "@aztec/noir-contracts.js/EasyPrivateToken";
import { MultiCallEntrypointContractArtifact } from "@aztec/noir-contracts.js/MultiCallEntrypoint";
import { FeeJuiceContractArtifact } from "@aztec/noir-contracts.js/FeeJuice";
import { FPCContractArtifact } from "@aztec/noir-contracts.js/FPC";
import { NFTContractArtifact } from "@aztec/noir-contracts.js/NFT";
import { RouterContractArtifact } from "@aztec/noir-contracts.js/Router";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { TokenContractArtifact } from "@aztec/noir-contracts.js/Token";
import { TokenBlacklistContractArtifact } from "@aztec/noir-contracts.js/TokenBlacklist";
import { type ContractArtifact, ContractArtifactSchema } from "@aztec/stdlib/abi";
import { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    type ContractClassWithId,
    type ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    getContractInstanceFromDeployParams,
} from "@aztec/stdlib/contract";
import { type AztecNode, type ContractClassMetadata, type ContractMetadata, createAztecNodeClient, type PXE } from "@aztec/stdlib/interfaces/client";
import { NotesFilterSchema } from "@aztec/stdlib/note";
import { PrivateExecutionResult, SimulationOverrides, Tx, TxExecutionRequest } from "@aztec/stdlib/tx";
import z from "zod";
import { Service } from "@/wallet/base/message-service/service.ts";
import { type Profile, ProfileServiceClient } from "@/wallet/services/profile/client";
import type { Network } from "@/wallet/services/network/client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { Lock } from "@/wallet/utils";
import {
    type GetContractClassMetadataParams,
    type GetContractMetadataParams, 
    type GetContractsParams,
    type GetCurrentBaseFeesParams,
    type GetNodeInfoParams,
    type GetNotesParams,
    type GetPXEInfoParams,
    type GetSendersParams,
    type GetRegisteredAccountsParams,
    type ProveTxParams,
    type RegisterAccountParams,
    type RegisterContractParams,
    type RegisterSenderParams,
    type RemoveSenderParams,
    type SendTxParams,
    type SimulateTxParams,
    type SimulateUtilityParams,
    PXE_SERVICE_NAME,
    PxeServiceMethod,
    type UpdateContractParams,
} from "./client";

export class PxeService extends Service<PxeServiceMethod, void> {
    private readonly profileService: ProfileServiceClient;
    private readonly nodes = new Map<number, AztecNode>();
    private readonly pxes = new Map<number, PXE>();
    private readonly rpcs = new Map<number, string>();
    private readonly lock = new Lock();
	private init: Promise<void> | null;

    private readonly knownArtifacts = new Map<string, ContractArtifact>();
    private readonly knownClasses = new Map<string, ContractClassWithId>();
    private readonly knownInstances = new Map<string, ContractInstanceWithAddress>();

    public constructor() {
        super(PXE_SERVICE_NAME, new LoggerServiceClient());
        this.profileService = new ProfileServiceClient(
            undefined,
            undefined,
            undefined,
            undefined,
            this.onProfileDeleted,
            this.onActiveProfileChanged,
        );
		this.init = this.initialize();
    }

    protected async onRequest(method: PxeServiceMethod, params: unknown): Promise<unknown> {
		await this.ensureInitialized();
        switch (method) {
            case PxeServiceMethod.GetContractClassMetadata: {
                const { network, id } = params as GetContractClassMetadataParams;
                return await this.getContractClassMetadata(network, await Fr.schema.parseAsync(id));
            }
            case PxeServiceMethod.GetContractMetadata: {
                const { network, address } = params as GetContractMetadataParams;
                return await this.getContractMetadata(network, await AztecAddress.schema.parseAsync(address));
            }
            case PxeServiceMethod.GetContracts: {
                const { network } = params as GetContractsParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getContracts();
            }
            case PxeServiceMethod.GetCurrentBaseFees: {
                const { network } = params as GetCurrentBaseFeesParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getCurrentBaseFees();
            }
            case PxeServiceMethod.GetNodeInfo: {
                const { network } = params as GetNodeInfoParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getNodeInfo();
            }
            case PxeServiceMethod.GetNotes: {
                const { network, filter } = params as GetNotesParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getNotes(await NotesFilterSchema.parseAsync(filter));
            }
            case PxeServiceMethod.GetPXEInfo: {
                const { network } = params as GetPXEInfoParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getPXEInfo();
            }
            case PxeServiceMethod.GetSenders: {
                const { network } = params as GetSendersParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getSenders();
            }
            case PxeServiceMethod.GetRegisteredAccounts: {
                const { network } = params as GetRegisteredAccountsParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.getRegisteredAccounts();
            }
            case PxeServiceMethod.ProveTx: {
                const { network, txRequest, privateExecutionResult } = params as ProveTxParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.proveTx(
                    await TxExecutionRequest.schema.parseAsync(txRequest),
                    await PrivateExecutionResult.schema.parseAsync(privateExecutionResult),
                );
            }
            case PxeServiceMethod.RegisterAccount: {
                const { network, secretKey, partialAddress } = params as RegisterAccountParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.registerAccount(
                    await Fr.schema.parseAsync(secretKey),
                    await Fr.schema.parseAsync(partialAddress),
                );
            }
            case PxeServiceMethod.RegisterContract: {
                const { network, contract } = params as RegisterContractParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.registerContract({
                    instance: await ContractInstanceWithAddressSchema.parseAsync(contract.instance),
                    artifact: await ContractArtifactSchema.optional().parseAsync(contract.artifact),
                });
            }
            case PxeServiceMethod.RegisterSender: {
                const { network, address } = params as RegisterSenderParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.registerSender(await AztecAddress.schema.parseAsync(address));
            }
            case PxeServiceMethod.RemoveSender: {
                const { network, address } = params as RemoveSenderParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.removeSender(await AztecAddress.schema.parseAsync(address));
            }
            case PxeServiceMethod.SendTx: {
                const { network, tx } = params as SendTxParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.sendTx(await Tx.schema.parseAsync(tx));
            }
            case PxeServiceMethod.SimulateTx: {
                const {
                    network,
                    txRequest,
                    simulatePublic,
                    skipTxValidation,
                    skipFeeEnforcement,
                    overrides,
                    scopes,
                } = params as SimulateTxParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.simulateTx(
                    await TxExecutionRequest.schema.parseAsync(txRequest),
                    simulatePublic,
                    skipTxValidation,
                    skipFeeEnforcement,
                    await SimulationOverrides.schema.optional().parseAsync(overrides),
                    await z.array(AztecAddress.schema).optional().parseAsync(scopes),
                );
            }
            case PxeServiceMethod.SimulateUtility: {
                const {
                    network,
                    functionName,
                    args,
                    to,
                    authwits,
                    from,
                    scopes,
                } = params as SimulateUtilityParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.simulateUtility(
                    functionName,
                    args,
                    await AztecAddress.schema.parseAsync(to),
                    await z.array(AuthWitness.schema).optional().parseAsync(authwits),
                    await AztecAddress.schema.optional().parseAsync(from),
                    await z.array(AztecAddress.schema).optional().parseAsync(scopes),
                );
            }
            case PxeServiceMethod.UpdateContract: {
                const { network, address, artifact } = params as UpdateContractParams;
                const pxe = await this.getPxeClient(network);
                return await pxe.updateContract(
                    await AztecAddress.schema.parseAsync(address),
                    await ContractArtifactSchema.parseAsync(artifact),
                );
            }
            default: {
                throw new Error("Unknown method");
            }
        }
    }

    private async getContractMetadata(network: Network, address: AztecAddress): Promise<ContractMetadata> {
        const pxe = await this.getPxeClient(network);
        const metadata = await pxe.getContractMetadata(address);
        if (!metadata.contractInstance) {
            // check node
            const node = await this.getNodeClient(network);
            metadata.contractInstance = await node.getContract(address);
            if (!metadata.contractInstance) {
                // check known
                if (!this.knownInstances.size) {
                    await this.initKnown();
                }
                metadata.contractInstance = this.knownInstances.get(address.toString());
                if (!metadata.contractInstance) {
                    // check registry
                    metadata.contractInstance = await this.fetchInstanceFromRegistry(network, address);
                }
            }
        }
        return metadata;
    }

    private async getContractClassMetadata(network: Network, classId: Fr): Promise<ContractClassMetadata> {
        const pxe = await this.getPxeClient(network);
        const metadata = await pxe.getContractClassMetadata(classId, true);
        if (!metadata.artifact) {
            // check known
            if (!this.knownArtifacts.size) {
                await this.initKnown();
            }
            metadata.artifact = this.knownArtifacts.get(classId.toString());
            if (!metadata.artifact) {
                // check registry
                metadata.artifact = await this.fetchArtifactFromRegistry(network, classId);
            }
        }
        if (!metadata.contractClass) {
            if (!this.knownClasses.size) {
                await this.initKnown();
            }
            metadata.contractClass = this.knownClasses.get(classId.toString());
            // compute manually
            if (!metadata.contractClass && metadata.artifact) {
                metadata.contractClass = await getContractClassFromArtifact(metadata.artifact);
            }
        }
        return metadata;
    }

    private async initKnown() {
        for (const artifact of [
            // protocol
            AuthRegistryContractArtifact,
            ContractInstanceDeployerContractArtifact,
            ContractClassRegistererContractArtifact,
            MultiCallEntrypointContractArtifact,
            FeeJuiceContractArtifact,
            RouterContractArtifact,
            // other
            FPCContractArtifact,
            SponsoredFPCContractArtifact,
            TokenContractArtifact,
            NFTContractArtifact,
            EasyPrivateTokenContractArtifact,
            TokenBlacklistContractArtifact,
        ]) {
            const contractClass = await getContractClassFromArtifact(artifact);
            this.knownArtifacts.set(contractClass.id.toString(), artifact);
            this.knownClasses.set(contractClass.id.toString(), contractClass);
        }

        const sponsoredFpcInstance = await getContractInstanceFromDeployParams(
            SponsoredFPCContractArtifact,
            { salt: new Fr(SPONSORED_FPC_SALT) },
        );
        this.knownInstances.set(sponsoredFpcInstance.address.toString(), sponsoredFpcInstance);
    }

	private async getNodeClient(network: Network): Promise<AztecNode> {
        try {
            await this.lock.enter();
            if (!this.hasChain(network)) {
                await this.initChain(network);
            }
            return this.nodes.get(network.chainId)!;
        }
        finally {
            this.lock.leave();
        }
	}

    private async getPxeClient(network: Network): Promise<PXE> {
        try {
            await this.lock.enter();
            if (!this.hasChain(network)) {
                await this.initChain(network);
            }
            return this.pxes.get(network.chainId)!;
        }
        finally {
            this.lock.leave();
        }
    }

    private hasChain(network: Network): boolean {
        return this.rpcs.get(network.chainId) === network.rpcUrl;
    }

    private async initChain(network: Network): Promise<void> {
        const node = createAztecNodeClient(network.rpcUrl);
        const l1Contracts = await node.getL1ContractAddresses();
        const config = {
            ...getPXEServiceConfig(),
            l1Contracts,
            dataDirectory: `pxe/${network.profileId}/${network.chainId}`,
            proverEnabled: true,
        } as PXEServiceConfig;
        const pxe = await createPXEService(node, config);

        this.nodes.set(network.chainId, node);
        this.pxes.set(network.chainId, pxe);
        this.rpcs.set(network.chainId, network.rpcUrl);
    }

    private readonly onProfileDeleted = async (profile: Profile): Promise<void> => {
        try {
            await this.lock.enter();
            this.nodes.clear();
            this.pxes.clear();
            this.rpcs.clear();
            for (const db of await indexedDB.databases()) {
                if (db.name?.startsWith(`pxe/${profile.id}/`) || db.name === "keyval-store") {
                    const _ = indexedDB.deleteDatabase(db.name);
                }
            }
        }
        finally {
            this.lock.leave();
        }
    }

    private readonly onActiveProfileChanged = async (): Promise<void> => {
        try {
            await this.lock.enter();
            this.nodes.clear();
            this.pxes.clear();
            this.rpcs.clear();
        }
        finally {
            this.lock.leave();
        }
    }

    private async fetchArtifactFromRegistry(network: Network, classId: Fr): Promise<ContractArtifact | undefined> {
        try {
            const artifact = await this.fetchFromRegistry(network, `/artifacts/${classId.toString()}`);
            if (!artifact) {
                return undefined;
            }
            return await ContractArtifactSchema.parseAsync(artifact);
        }
        catch (error: unknown) {
            this.logError("Failed to parse artifact from registry", error)
            return undefined;
        }
    }

    private async fetchInstanceFromRegistry(network: Network, address: AztecAddress): Promise<ContractInstanceWithAddress | undefined> {
        try {
            const instance = await this.fetchFromRegistry(network, `/instances/${address.toString()}`);
            if (!instance) {
                return undefined;
            }
            return await ContractInstanceWithAddressSchema.parseAsync(instance);
        }
        catch (error: unknown) {
            this.logError("Failed to parse instance from registry", error)
            return undefined;
        }
    }

    private async fetchFromRegistry(network: Network, path: string): Promise<unknown | undefined> {
        const registryUrl = this.getRegistryUrl(network);
        if (!registryUrl) {
            return undefined;
        }
        try {
            const data = await fetch(`${registryUrl}${path}`);
            if (!data.ok) {
                this.logDebug("Failed to get artifact from public registry", data.status, data.statusText)
                return undefined;
            }
            return await data.json();
        }
        catch (error: unknown) {
            this.logError("Failed to get artifact from public registry", error)
            return undefined;
        }
    }

    private getRegistryUrl(network: Network): string | undefined {
        switch (network.chainId) {
            case 11155111:
                return "https://registry.testnet.azguardwallet.io";
            case 1337:
                return "https://registry.devnet.azguardwallet.io";
            default:
                return undefined;
        }
    }

	private async initialize(): Promise<void> {
		console.debug("Initialize pxe service");
		await this.checkMigrations();
		console.debug("Pxe service initialized");
		this.init = null;
	}

	private async ensureInitialized(): Promise<void> {
		if (this.init) {
			await this.init;
		}
	}

	private async checkMigrations(): Promise<void> {
		try {
			console.debug("Check pxe service migrations");
			switch (localStorage.getItem("v")) {
				case "1": {
					console.debug("No migrations needed");
					break;
				}
				default: {
					await this.migrate_0_1();
					break;
				}
			}
		}
		catch (error: unknown) {
			console.error("Failed to migrate pxe service", error);
		}
	}
	
	private async migrate_0_1(): Promise<void> {
		console.debug("Migrating pxe service");
        const keyvalDb = (await indexedDB.databases()).find(x => x.name === "keyval-store");
        if (keyvalDb) {
            console.debug("Drop 'keyval-store' db")
            const _ = indexedDB.deleteDatabase(keyvalDb.name!);
        }
		console.debug("Set pxe service version to 1");
		localStorage.setItem("v", "1");
		console.debug("Pxe service migrated");
    }
}
