import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { getPXEServiceConfig, type PXEServiceConfig } from "@aztec/pxe/config";
import { createPXEService } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/fields";
import { AuthRegistryContractArtifact } from "@aztec/noir-contracts.js/AuthRegistry";
// import { ContractInstanceDeployerContractArtifact } from "@aztec/noir-contracts.js/ContractRegistry";
// import { ContractClassRegistererContractArtifact } from "@aztec/noir-contracts.js/ContractClassRegisterer";
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
    getContractInstanceFromInstantiationParams,
    CompleteAddress,
    PartialAddress,
    NodeInfo,
} from "@aztec/stdlib/contract";
import { GasFees } from "@aztec/stdlib/gas";
import {
    type AztecNode,
    type ContractClassMetadata,
    type ContractMetadata,
    createAztecNodeClient,
    EventMetadataDefinition,
    type PXE,
    PXEInfo,
} from "@aztec/stdlib/interfaces/client";
import { NotesFilterSchema, NotesFilter, UniqueNote } from "@aztec/stdlib/note";
import {
    PrivateExecutionResult,
    SimulationOverrides,
    Tx,
    TxExecutionRequest,
    TxProvingResult,
    TxSimulationResult,
    UtilitySimulationResult,
    TxHash,
    TxReceipt,
    TxProfileResult,
} from "@aztec/stdlib/tx";
import z from "zod";
import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/offscreen";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { Network } from "@/wallet/services/network/client";
import { ProfileServiceClient, ProfileInfo } from "@/wallet/services/profile/client";
import { Lock } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { Methods, PXE_SERVICE_NAME } from "./spec";
import { EventMetadataDefinitionSchema } from "@/wallet/utils/schemas";

export * from "./spec";

export class PxeService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = PXE_SERVICE_NAME;

    private readonly profiles = new ProfileServiceClient();
    private readonly nodes = new Map<number, AztecNode>();
    private readonly pxes = new Map<number, PXE>();
    private readonly rpcs = new Map<number, string>();
    private readonly lock = new Lock();

    private readonly knownArtifacts = new Map<string, ContractArtifact>();
    private readonly knownClasses = new Map<string, ContractClassWithId>();
    private readonly knownInstances = new Map<string, ContractInstanceWithAddress>();

    public constructor() {
        super(PXE_SERVICE_NAME, new LoggerServiceClient());
    }

    protected async init() {
        // delete orhpan PXE DBs
        const dbs = await indexedDB.databases();
        const pxes = dbs.filter(x => x.name?.startsWith("pxe/"));
        if (pxes.length) {
            const profiles = await this.profiles.getProfiles();
            for (let i = pxes.length - 1; i >= 0; i--) {
                if (!profiles.some(x => pxes[i].name!.startsWith(`pxe/${x.id}/`))) {
                    const _ = indexedDB.deleteDatabase(pxes[i].name!);
                    pxes.splice(i, 1);
                }
            }
            if (!pxes.length) {
                const keyval = dbs.find(x => x.name === "keyval-store");
                if (keyval) {
                    const _ = indexedDB.deleteDatabase(keyval.name!);
                }
            }
        }

        this.profiles.onProfileDeleted.add(this.onProfileDeleted);
        this.profiles.onActiveProfileChanged.add(this.onActiveProfileChanged);
        const _ = this.profiles.connect();
    }

    public async getContractClassMetadata(network: Network, id: Fr): Promise<ContractClassMetadata> {
        id = await Fr.schema.parseAsync(id);
        const pxe = await this.getPxeClient(network);
        const metadata = await pxe.getContractClassMetadata(id, true);
        if (!metadata.artifact) {
            // check known
            if (!this.knownArtifacts.size) {
                await this.initKnown();
            }
            metadata.artifact = this.knownArtifacts.get(id.toString());
            if (!metadata.artifact) {
                // check registry
                metadata.artifact = await this.fetchArtifactFromRegistry(network, id);
            }
        }
        if (!metadata.contractClass) {
            if (!this.knownClasses.size) {
                await this.initKnown();
            }
            metadata.contractClass = this.knownClasses.get(id.toString());
            // compute manually
            if (!metadata.contractClass && metadata.artifact) {
                metadata.contractClass = await getContractClassFromArtifact(metadata.artifact);
            }
        }
        return metadata;
    }

    public async getContractMetadata(network: Network, address: AztecAddress): Promise<ContractMetadata> {
        address = await AztecAddress.schema.parseAsync(address);
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

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getContracts();
    }

    public async getCurrentBaseFees(network: Network): Promise<GasFees> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getCurrentBaseFees();
    }

    public async getNodeInfo(network: Network): Promise<NodeInfo> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getNodeInfo();
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<UniqueNote[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getNotes(await NotesFilterSchema.parseAsync(filter));
    }

    public async getPXEInfo(network: Network): Promise<PXEInfo> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getPXEInfo();
    }

    public async getPublicStorageAt(network: Network, contract: AztecAddress, slot: Fr): Promise<Fr> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getPublicStorageAt(
            await AztecAddress.schema.parseAsync(contract),
            await Fr.schema.parseAsync(slot),
        );
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getSenders();
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getRegisteredAccounts();
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        privateExecutionResult: PrivateExecutionResult,
    ): Promise<TxProvingResult> {
        const pxe = await this.getPxeClient(network);
        return await pxe.proveTx(
            await TxExecutionRequest.schema.parseAsync(txRequest),
            await PrivateExecutionResult.schema.parseAsync(privateExecutionResult),
        );
    }

    public async registerAccount(
        network: Network,
        secretKey: Fr,
        partialAddress: PartialAddress,
    ): Promise<CompleteAddress> {
        const pxe = await this.getPxeClient(network);
        return await pxe.registerAccount(
            await Fr.schema.parseAsync(secretKey),
            await Fr.schema.parseAsync(partialAddress),
        );
    }

    public async registerContract(
        network: Network,
        instance: ContractInstanceWithAddress,
        artifact?: ContractArtifact,
    ): Promise<void> {
        const pxe = await this.getPxeClient(network);
        return await pxe.registerContract({
            instance: await ContractInstanceWithAddressSchema.parseAsync(instance),
            artifact: await ContractArtifactSchema.optional().parseAsync(artifact),
        });
    }

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        const pxe = await this.getPxeClient(network);
        return await pxe.registerSender(await AztecAddress.schema.parseAsync(address));
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        const pxe = await this.getPxeClient(network);
        return await pxe.removeSender(await AztecAddress.schema.parseAsync(address));
    }

    public async sendTx(network: Network, tx: Tx): Promise<TxHash> {
        const pxe = await this.getPxeClient(network);
        return await pxe.sendTx(await Tx.schema.parseAsync(tx));
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

    public async simulateUtility(
        network: Network,
        functionName: string,
        args: any[],
        to: AztecAddress,
        authwits?: AuthWitness[],
        from?: AztecAddress,
        scopes?: AztecAddress[],
    ): Promise<UtilitySimulationResult> {
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

    public async updateContract(
        network: Network,
        contractAddress: AztecAddress,
        artifact: ContractArtifact,
    ): Promise<void> {
        const pxe = await this.getPxeClient(network);
        return await pxe.updateContract(
            await AztecAddress.schema.parseAsync(contractAddress),
            await ContractArtifactSchema.parseAsync(artifact),
        );
    }

    public async registerContractClass(network: Network, artifact: ContractArtifact): Promise<void> {
        const pxe = await this.getPxeClient(network);
        return await pxe.registerContractClass(await ContractArtifactSchema.parseAsync(artifact));
    }

    public async getTxReceipt(network: Network, txHash: TxHash): Promise<TxReceipt> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getTxReceipt(await TxHash.schema.parseAsync(txHash));
    }

    public async getPrivateEvents(
        network: Network,
        contractAddress: AztecAddress,
        eventMetadata: EventMetadataDefinition,
        from: number,
        numBlocks: number,
        recipients: AztecAddress[],
    ): Promise<unknown[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getPrivateEvents(
            await AztecAddress.schema.parseAsync(contractAddress),
            await EventMetadataDefinitionSchema.parseAsync(eventMetadata),
            from,
            numBlocks,
            await z.array(AztecAddress.schema).parseAsync(recipients),
        );
    }

    public async getPublicEvents(
        network: Network,
        eventMetadata: EventMetadataDefinition,
        from: number,
        limit: number,
    ): Promise<unknown[]> {
        const pxe = await this.getPxeClient(network);
        return await pxe.getPublicEvents(await EventMetadataDefinitionSchema.parseAsync(eventMetadata), from, limit);
    }

    public async profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        profileMode: "gates" | "execution-steps" | "full",
        skipProofGeneration?: boolean,
        msgSender?: AztecAddress,
    ): Promise<TxProfileResult> {
        const pxe = await this.getPxeClient(network);
        return await pxe.profileTx(
            await TxExecutionRequest.schema.parseAsync(txRequest),
            profileMode,
            skipProofGeneration,
            await AztecAddress.schema.optional().parseAsync(msgSender),
        );
    }

    private async initKnown() {
        for (const artifact of [
            // protocol
            AuthRegistryContractArtifact,
            // ContractInstanceDeployerContractArtifact,
            // ContractClassRegistererContractArtifact,
            MultiCallEntrypointContractArtifact,
            FeeJuiceContractArtifact,
            RouterContractArtifact,
            // other
            FPCContractArtifact,
            SponsoredFPCContractArtifact,
            TokenContractArtifact,
            NFTContractArtifact,
            TokenBlacklistContractArtifact,
        ]) {
            const contractClass = await getContractClassFromArtifact(artifact);
            this.knownArtifacts.set(contractClass.id.toString(), artifact);
            this.knownClasses.set(contractClass.id.toString(), contractClass);
        }

        const sponsoredFpcInstance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
            salt: new Fr(SPONSORED_FPC_SALT),
        });
        this.knownInstances.set(sponsoredFpcInstance.address.toString(), sponsoredFpcInstance);
    }

    private async getNodeClient(network: Network): Promise<AztecNode> {
        try {
            await this.lock.enter();
            if (!this.hasChain(network)) {
                await this.initChain(network);
            }
            return this.nodes.get(network.chainId)!;
        } finally {
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
        } finally {
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

    private async fetchArtifactFromRegistry(network: Network, classId: Fr): Promise<ContractArtifact | undefined> {
        try {
            const artifact = await this.fetchFromRegistry(network, `/artifacts/${classId.toString()}`);
            if (!artifact) {
                return undefined;
            }
            return await ContractArtifactSchema.parseAsync(artifact);
        } catch (error: unknown) {
            this.logError("Failed to parse artifact from registry", getErrorMessage(error));
            return undefined;
        }
    }

    private async fetchInstanceFromRegistry(
        network: Network,
        address: AztecAddress,
    ): Promise<ContractInstanceWithAddress | undefined> {
        try {
            const instance = await this.fetchFromRegistry(network, `/instances/${address.toString()}`);
            if (!instance) {
                return undefined;
            }
            return await ContractInstanceWithAddressSchema.parseAsync(instance);
        } catch (error: unknown) {
            this.logError("Failed to parse instance from registry", getErrorMessage(error));
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
                if (data.status !== 404) {
                    this.logDebug("Failed to get artifact from public registry", data.status, data.statusText);
                }
                return undefined;
            }
            return await data.json();
        } catch (error: unknown) {
            this.logError("Failed to get artifact from public registry", getErrorMessage(error));
            return undefined;
        }
    }

    private getRegistryUrl(network: Network): string | undefined {
        switch (network.chainId) {
            case 11155111:
                return "https://registry.testnet.azguardwallet.io";
            default:
                return undefined;
        }
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo): Promise<void> => {
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
        } finally {
            this.lock.leave();
        }
    };

    private readonly onActiveProfileChanged = async (): Promise<void> => {
        try {
            await this.lock.enter();
            this.nodes.clear();
            this.pxes.clear();
            this.rpcs.clear();
        } finally {
            this.lock.leave();
        }
    };
}
