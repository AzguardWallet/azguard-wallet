import { SPONSORED_FPC_SALT } from "@aztec/constants";
import { getPXEConfig, type PXEConfig } from "@aztec/pxe/config";
import { createPXE, PackedPrivateEvent, PXE } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/curves/bn254";
import { AuthRegistryArtifact } from "@aztec/standard-contracts/auth-registry";
import { ContractClassRegistryArtifact } from "@aztec/protocol-contracts/class-registry";
import { FeeJuiceArtifact } from "@aztec/protocol-contracts/fee-juice";
import { ContractInstanceRegistryArtifact } from "@aztec/protocol-contracts/instance-registry";
import { MultiCallEntrypointArtifact } from "@aztec/standard-contracts/multi-call-entrypoint";
import { PublicChecksArtifact } from "@aztec/standard-contracts/public-checks";
import { FPCContractArtifact } from "@aztec/noir-contracts.js/FPC";
import { NFTContractArtifact } from "@aztec/noir-contracts.js/NFT";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { TokenContractArtifact } from "@aztec/noir-contracts.js/Token";
import { PrivateFPCContractArtifact } from "@/wallet/services/fpc/artifacts";
import { type ContractArtifact, ContractArtifactSchema, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
import { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    type ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    getContractInstanceFromInstantiationParams,
    CompleteAddress,
    PartialAddress,
} from "@aztec/stdlib/contract";
import { type AztecNode, createBatchCappedAztecNodeClient } from "@/wallet/utils/aztec-node-client";
import { NoteDao } from "@aztec/stdlib/note";
import type { NotesFilter } from "./spec";
import {
    SimulationOverrides,
    TxExecutionRequest,
    TxProvingResult,
    TxSimulationResult,
    UtilityExecutionResult,
    TxProfileResult,
} from "@aztec/stdlib/tx";
import type { SimulateTxOpts, ExecuteUtilityOpts, ProfileTxOpts, ProveTxOpts } from "@aztec/pxe/client/bundle";
import z from "zod";

const AccessScopesSchema = z.array(AztecAddress.schema);
import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/offscreen";
import { ConfigServiceClient } from "@/wallet/services/config/client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { Network } from "@/wallet/services/network/client";
import { ProfileServiceClient, ProfileInfo } from "@/wallet/services/profile/client";
import { Lock } from "@/wallet/utils";
import { getErrorMessage } from "@/wallet/utils/errors";
import { Methods, PXE_SERVICE_NAME } from "./spec";
import { PrivateEventFilter, PrivateEventFilterSchema } from "@aztec/aztec.js/wallet";
import { NotesFilterSchema } from "@/wallet/utils/schemas";

export * from "./spec";

export class PxeService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = PXE_SERVICE_NAME;

    private readonly profiles = new ProfileServiceClient();
    private readonly config = new ConfigServiceClient();
    private readonly nodes = new Map<number, AztecNode>();
    private readonly pxes = new Map<number, PXE>();
    private readonly rpcs = new Map<number, string>();
    private readonly lock = new Lock();

    private readonly knownArtifacts = new Map<string, ContractArtifact>();
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

    public async getContractInstance(
        network: Network,
        address: AztecAddress,
        options?: { fetchFromNode?: boolean },
    ): Promise<ContractInstanceWithAddress | undefined> {
        const fetchFromNode = options?.fetchFromNode ?? true;
        address = await AztecAddress.schema.parseAsync(address);
        return this.withPxe(network, async (pxe, node) => {
            let instance = await pxe.getContractInstance(address);
            if (!instance && fetchFromNode) {
                // check node
                instance = await node.getContract(address);
                if (!instance) {
                    // check known
                    if (!this.knownInstances.size) {
                        await this.initKnown();
                    }
                    instance = this.knownInstances.get(address.toString());
                    if (!instance) {
                        // check registry
                        instance = await this.fetchInstanceFromRegistry(network, address);
                    }
                }
            }
            return instance;
        });
    }

    public async getContractArtifact(
        network: Network,
        id: Fr,
        options?: { fetchFromNode?: boolean },
    ): Promise<ContractArtifact | undefined> {
        const fetchFromNode = options?.fetchFromNode ?? true;
        id = await Fr.schema.parseAsync(id);
        return this.withPxe(network, async (pxe) => {
            let artifact = await pxe.getContractArtifact(id);
            if (!artifact && fetchFromNode) {
                // check known
                if (!this.knownArtifacts.size) {
                    await this.initKnown();
                }
                artifact = this.knownArtifacts.get(id.toString());
                if (!artifact) {
                    // check registry
                    artifact = await this.fetchArtifactFromRegistry(network, id);
                }
            }
            return artifact;
        });
    }

    public async registerAccount(
        network: Network,
        secretKey: Fr,
        partialAddress: PartialAddress,
    ): Promise<CompleteAddress> {
        return this.withPxe(network, async (pxe) =>
            pxe.registerAccount(
                await Fr.schema.parseAsync(secretKey),
                await Fr.schema.parseAsync(partialAddress),
            ),
        );
    }

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        return this.withPxe(network, async (pxe) => {
            const sender = await AztecAddress.schema.parseAsync(address);
            await pxe.registerTaggingSecretSource({ kind: "address-derived", sender });
            return sender;
        });
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        return this.withPxe(network, async (pxe) => {
            const sources = await pxe.getTaggingSecretSources({ kind: "address-derived" });
            return sources.map((s) => s.sender);
        });
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        return this.withPxe(network, async (pxe) =>
            pxe.removeTaggingSecretSource({
                kind: "address-derived",
                sender: await AztecAddress.schema.parseAsync(address),
            }),
        );
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        return this.withPxe(network, (pxe) => pxe.getRegisteredAccounts());
    }

    public async registerContractClass(network: Network, artifact: ContractArtifact): Promise<void> {
        return this.withPxe(network, async (pxe) =>
            pxe.registerContractClass(await ContractArtifactSchema.parseAsync(artifact)),
        );
    }

    public async registerContract(
        network: Network,
        contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact },
    ): Promise<void> {
        return this.withPxe(network, async (pxe) =>
            pxe.registerContract({
                instance: await ContractInstanceWithAddressSchema.parseAsync(contract.instance),
                artifact: await ContractArtifactSchema.optional().parseAsync(contract.artifact),
            }),
        );
    }

    public async updateContract(
        network: Network,
        contractAddress: AztecAddress,
        artifact: ContractArtifact,
    ): Promise<void> {
        return this.withPxe(network, async (pxe) =>
            pxe.updateContract(
                await AztecAddress.schema.parseAsync(contractAddress),
                await ContractArtifactSchema.parseAsync(artifact),
            ),
        );
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        return this.withPxe(network, (pxe) => pxe.getContracts());
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<NoteDao[]> {
        return this.withPxe(network, async (pxe) =>
            pxe.debug.getNotes(await NotesFilterSchema.parseAsync(filter)),
        );
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: ProveTxOpts,
    ): Promise<TxProvingResult> {
        return this.withPxe(network, async (pxe) =>
            pxe.proveTx(await TxExecutionRequest.schema.parseAsync(txRequest), {
                scopes: await z.array(AztecAddress.schema).parseAsync(opts.scopes),
                senderForTags: await AztecAddress.schema.optional().parseAsync(opts.senderForTags),
            }),
        );
    }

    public async simulateTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: SimulateTxOpts,
    ): Promise<TxSimulationResult> {
        return this.withPxe(network, async (pxe) => {
            return await pxe.simulateTx(await TxExecutionRequest.schema.parseAsync(txRequest), {
                simulatePublic: opts.simulatePublic,
                skipTxValidation: opts.skipTxValidation,
                skipFeeEnforcement: opts.skipFeeEnforcement,
                overrides: await SimulationOverrides.schema.optional().parseAsync(opts.overrides),
                scopes: await AccessScopesSchema.parseAsync(opts.scopes),
                senderForTags: await AztecAddress.schema.optional().parseAsync(opts.senderForTags),
            });
        });
    }

    public async executeUtility(
        network: Network,
        call: FunctionCall,
        opts: ExecuteUtilityOpts,
    ): Promise<UtilityExecutionResult> {
        return this.withPxe(network, async (pxe) => {
            return await pxe.executeUtility(
                await FunctionCall.schema.parseAsync(call),
                {
                    authwits: await z.array(AuthWitness.schema).optional().parseAsync(opts.authwits),
                    scopes: await AccessScopesSchema.parseAsync(opts.scopes),
                },
            );
        });
    }

    public async profileTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: ProfileTxOpts,
    ): Promise<TxProfileResult> {
        return this.withPxe(network, async (pxe) => {
            return await pxe.profileTx(await TxExecutionRequest.schema.parseAsync(txRequest), {
                profileMode: opts.profileMode,
                skipProofGeneration: opts.skipProofGeneration,
                scopes: await AccessScopesSchema.parseAsync(opts.scopes),
                senderForTags: await AztecAddress.schema.optional().parseAsync(opts.senderForTags),
            });
        });
    }

    public async getPrivateEvents(
        network: Network,
        eventSelector: EventSelector,
        filter: PrivateEventFilter,
    ): Promise<PackedPrivateEvent[]> {
        return this.withPxe(network, async (pxe) =>
            pxe.getPrivateEvents(
                await EventSelector.schema.parseAsync(eventSelector),
                await PrivateEventFilterSchema.parseAsync(filter),
            ),
        );
    }

    private async initKnown() {
        for (const artifact of [
            // protocol
            AuthRegistryArtifact,
            ContractClassRegistryArtifact,
            FeeJuiceArtifact,
            ContractInstanceRegistryArtifact,
            MultiCallEntrypointArtifact,
            PublicChecksArtifact,
            // other
            FPCContractArtifact,
            NFTContractArtifact,
            SponsoredFPCContractArtifact,
            TokenContractArtifact,
            PrivateFPCContractArtifact,
        ]) {
            const contractClass = await getContractClassFromArtifact(artifact);
            this.knownArtifacts.set(contractClass.id.toString(), artifact);
        }

        const sponsoredFpcInstance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
            salt: new Fr(SPONSORED_FPC_SALT),
        });
        this.knownInstances.set(sponsoredFpcInstance.address.toString(), sponsoredFpcInstance);

        const privateFpcInstance = await getContractInstanceFromInstantiationParams(PrivateFPCContractArtifact, {
            constructorArgs: [],
            salt: Fr.zero(),
        });
        this.knownInstances.set(privateFpcInstance.address.toString(), privateFpcInstance);
    }

    private async withPxe<T>(network: Network, fn: (pxe: PXE, node: AztecNode) => Promise<T>): Promise<T> {
        try {
            await this.lock.enter();
            if (!this.hasChain(network)) {
                await this.initChain(network);
            }
            return await fn(this.pxes.get(network.chainId)!, this.nodes.get(network.chainId)!);
        } finally {
            this.lock.leave();
        }
    }

    private hasChain(network: Network): boolean {
        return this.rpcs.get(network.chainId) === network.rpcUrl;
    }

    private async initChain(network: Network): Promise<void> {
        const node = createBatchCappedAztecNodeClient(network.rpcUrl);
        const config = {
            ...getPXEConfig(),
            dataDirectory: `pxe/${network.profileId}/${network.chainId}`,
            proverEnabled: true,
        } as PXEConfig;
        const pxe = await createPXE(node, config);

        this.nodes.set(network.chainId, node);
        this.pxes.set(network.chainId, pxe);
        this.rpcs.set(network.chainId, network.rpcUrl);
    }

    private async fetchArtifactFromRegistry(
        network: Network,
        classId: Fr,
    ): Promise<ContractArtifact | undefined> {
        try {
            const artifact = await this.fetchFromRegistry(network, `/api/artifacts/${classId.toString()}`);
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
        return undefined;
        // try {
        //     const instance = await this.fetchFromRegistry(network, `/api/contracts/${address.toString()}`);
        //     if (!instance) {
        //         return undefined;
        //     }
        //     return await ContractInstanceWithAddressSchema.parseAsync(instance);
        // } catch (error: unknown) {
        //     this.logError("Failed to parse instance from registry", getErrorMessage(error));
        //     return undefined;
        // }
    }

    private async fetchFromRegistry(network: Network, path: string): Promise<unknown | undefined> {
        // Check if contract registry is enabled in settings
        const contractRegistryEnabled = await this.config.getValue("contractRegistry");
        if (!contractRegistryEnabled) {
            return undefined;
        }

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
            case 2934756904: // alphanet (mainnet), 1 ^ 2934756905
                return "https://mainnet.aztec-registry.xyz";
            case 2793892258: // 11155111 ^ 2787991301
                return "https://testnet.aztec-registry.xyz";
            case 604129785: // 11155111 ^ 615022430
                return "https://devnet.aztec-registry.xyz";
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
