// SponsoredFPC salt — standard deployment uses salt = 0
const SPONSORED_FPC_SALT = BigInt(0);
import { getPXEConfig, type PXEConfig } from "@aztec/pxe/config";
import { createPXE, PackedPrivateEvent, PXE } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/curves/bn254";
import { AuthRegistryArtifact } from "@aztec/protocol-contracts/auth-registry";
import { ContractClassRegistryArtifact } from "@aztec/protocol-contracts/class-registry";
import { FeeJuiceArtifact } from "@aztec/protocol-contracts/fee-juice";
import { ContractInstanceRegistryArtifact } from "@aztec/protocol-contracts/instance-registry";
import { MultiCallEntrypointArtifact } from "@aztec/protocol-contracts/multi-call-entrypoint";
import { PublicChecksArtifact } from "@aztec/protocol-contracts/public-checks";
import { FPCContractArtifact } from "@aztec/noir-contracts.js/FPC";
import { NFTContractArtifact } from "@aztec/noir-contracts.js/NFT";
import { SponsoredFPCContractArtifact } from "@aztec/noir-contracts.js/SponsoredFPC";
import { TokenContractArtifact } from "@aztec/noir-contracts.js/Token";
import { loadContractArtifact } from "@aztec/stdlib/abi";
import { type ContractArtifact, ContractArtifactSchema, EventSelector, FunctionCall } from "@aztec/stdlib/abi";
// @ts-ignore — raw JSON import via vite alias
import WonderlandTokenJson from "@wonderland-token-artifact";
const WonderlandTokenArtifact = loadContractArtifact(WonderlandTokenJson);
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
import { type AztecNode, createAztecNodeClient } from "@aztec/stdlib/interfaces/client";
import { makeFetchWithTimeout } from "@/wallet/utils/fetch";
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
import type { SimulateTxOpts, ExecuteUtilityOpts, ProfileTxOpts } from "@aztec/pxe/client/bundle";
import z from "zod";
import { AcceleratorProver } from "@alejoamiras/aztec-accelerator";

const AccessScopesSchema = z.union([z.literal("ALL_SCOPES"), z.array(AztecAddress.schema)]);
import { ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/offscreen";
import { ConfigServiceClient } from "@/wallet/services/config/client";
import { LoggerServiceClient } from "@/wallet/services/logger/client";
import { Network } from "@/wallet/services/network/client";
import { ProfileServiceClient, ProfileInfo } from "@/wallet/services/profile/client";
import { ReadWriteGuard } from "@/wallet/utils";
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
    private readonly loggerClient = new LoggerServiceClient();
    private readonly guard = new ReadWriteGuard("pxe", this.loggerClient);
    private readonly chainInitPromises = new Map<number, Promise<void>>();
    private initKnownPromise: Promise<void> | null = null;

    private readonly knownArtifacts = new Map<string, ContractArtifact>();
    private readonly knownInstances = new Map<string, ContractInstanceWithAddress>();

    public constructor() {
        super(PXE_SERVICE_NAME, new LoggerServiceClient());
    }

    protected async init() {
        // delete orphan PXE DBs
        const dbs = await indexedDB.databases();
        const pxes = dbs.filter(x => x.name?.startsWith("pxe/"));
        if (pxes.length) {
            const profiles = await this.profiles.getProfiles();
            for (let i = pxes.length - 1; i >= 0; i--) {
                if (!profiles.some(x => pxes[i].name!.startsWith(`pxe/${x.id}/`))) {
                    await new Promise<void>((resolve, reject) => {
                        const req = indexedDB.deleteDatabase(pxes[i].name!);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                        req.onblocked = () => {
                            this.logWarn("deleteDatabase blocked (DB still in use):", pxes[i].name);
                            resolve(); // Skip — don't hang init forever
                        };
                    });
                    pxes.splice(i, 1);
                }
            }
            if (!pxes.length) {
                const keyval = dbs.find(x => x.name === "keyval-store");
                if (keyval) {
                    await new Promise<void>((resolve, reject) => {
                        const req = indexedDB.deleteDatabase(keyval.name!);
                        req.onsuccess = () => resolve();
                        req.onerror = () => reject(req.error);
                        req.onblocked = () => {
                            this.logWarn("deleteDatabase blocked (DB still in use): keyval-store");
                            resolve();
                        };
                    });
                }
            }
        }

        this.profiles.onProfileDeleted.add(this.onProfileDeleted);
        this.profiles.onActiveProfileChanged.add(this.onActiveProfileChanged);
        await this.profiles.connect();
    }

    public async getContractInstance(
        network: Network,
        address: AztecAddress,
        opts?: { pxeOnly?: boolean },
    ): Promise<ContractInstanceWithAddress | undefined> {
        address = await AztecAddress.schema.parseAsync(address);
        return this.withPxeRead("getContractInstance", network, async (pxe, node) => {
            let instance = await pxe.getContractInstance(address);
            if (!instance && !opts?.pxeOnly) {
                // check node
                instance = await node.getContract(address);
                if (!instance) {
                    // check known
                    if (!this.knownInstances.size) {
                        await this.initKnown();
                    }
                    instance = this.knownInstances.get(address.toString());
                }
            }
            return instance;
        });
    }

    public async getContractArtifact(
        network: Network,
        id: Fr,
        opts?: { pxeOnly?: boolean },
    ): Promise<ContractArtifact | undefined> {
        id = await Fr.schema.parseAsync(id);
        return this.withPxeRead("getContractArtifact", network, async (pxe) => {
            let artifact = await pxe.getContractArtifact(id);
            if (!artifact && !opts?.pxeOnly) {
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
        return this.withPxeWrite("registerAccount", network, async (pxe) =>
            pxe.registerAccount(
                await Fr.schema.parseAsync(secretKey),
                await Fr.schema.parseAsync(partialAddress),
            ),
        );
    }

    public async registerSender(network: Network, address: AztecAddress): Promise<AztecAddress> {
        return this.withPxeWrite("registerSender", network, async (pxe) =>
            pxe.registerSender(await AztecAddress.schema.parseAsync(address)),
        );
    }

    public async getSenders(network: Network): Promise<AztecAddress[]> {
        return this.withPxeRead("getSenders", network, (pxe) => pxe.getSenders());
    }

    public async removeSender(network: Network, address: AztecAddress): Promise<void> {
        return this.withPxeWrite("removeSender", network, async (pxe) =>
            pxe.removeSender(await AztecAddress.schema.parseAsync(address)),
        );
    }

    public async getRegisteredAccounts(network: Network): Promise<CompleteAddress[]> {
        return this.withPxeRead("getRegisteredAccounts", network, (pxe) => pxe.getRegisteredAccounts());
    }

    public async registerContractClass(network: Network, artifact: ContractArtifact): Promise<void> {
        return this.withPxeWrite("registerContractClass", network, async (pxe) =>
            pxe.registerContractClass(await ContractArtifactSchema.parseAsync(artifact)),
        );
    }

    public async registerContract(
        network: Network,
        contract: { instance: ContractInstanceWithAddress; artifact?: ContractArtifact },
    ): Promise<void> {
        return this.withPxeWrite("registerContract", network, async (pxe) =>
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
        return this.withPxeWrite("updateContract", network, async (pxe) =>
            pxe.updateContract(
                await AztecAddress.schema.parseAsync(contractAddress),
                await ContractArtifactSchema.parseAsync(artifact),
            ),
        );
    }

    public async getContracts(network: Network): Promise<AztecAddress[]> {
        return this.withPxeRead("getContracts", network, (pxe) => pxe.getContracts());
    }

    public async getNotes(network: Network, filter: NotesFilter): Promise<NoteDao[]> {
        return this.withPxeWrite("getNotes", network, async (pxe) =>
            pxe.debug.getNotes(await NotesFilterSchema.parseAsync(filter)),
        );
    }

    public async proveTx(
        network: Network,
        txRequest: TxExecutionRequest,
        scopes: AztecAddress[],
    ): Promise<TxProvingResult> {
        return this.withPxeWrite("proveTx", network, async (pxe) =>
            pxe.proveTx(
                await TxExecutionRequest.schema.parseAsync(txRequest),
                await z.array(AztecAddress.schema).parseAsync(scopes),
            ),
        );
    }

    public async simulateTx(
        network: Network,
        txRequest: TxExecutionRequest,
        opts: SimulateTxOpts,
        stubAccountAddresses?: string[],
    ): Promise<TxSimulationResult> {
        return this.withPxeWrite("simulateTx", network, async (pxe) => {
            let overrides = await SimulationOverrides.schema.optional().parseAsync(opts.overrides);

            // Build stub account overrides for kernelless simulation.
            // The SimulatedAccountContractArtifact stays on the offscreen side — only address strings cross the RPC bridge.
            if (stubAccountAddresses?.length) {
                const { SimulatedAccountContractArtifact } = await import("@aztec/noir-contracts.js/SimulatedAccount");
                const contracts: Record<string, { instance: ContractInstanceWithAddress; artifact: ContractArtifact }> = {};
                for (const addr of stubAccountAddresses) {
                    const instance = await getContractInstanceFromInstantiationParams(
                        SimulatedAccountContractArtifact,
                        { salt: Fr.random() },
                    );
                    contracts[addr] = { instance, artifact: SimulatedAccountContractArtifact };
                }
                overrides = new SimulationOverrides({ ...(overrides?.contracts ?? {}), ...contracts });
            }

            return await pxe.simulateTx(
                await TxExecutionRequest.schema.parseAsync(txRequest),
                {
                    simulatePublic: opts.simulatePublic,
                    skipTxValidation: opts.skipTxValidation,
                    skipFeeEnforcement: opts.skipFeeEnforcement,
                    overrides,
                    scopes: await AccessScopesSchema.parseAsync(opts.scopes),
                },
            );
        });
    }

    public async executeUtility(
        network: Network,
        call: FunctionCall,
        opts: ExecuteUtilityOpts,
    ): Promise<UtilityExecutionResult> {
        return this.withPxeWrite("executeUtility", network, async (pxe) => {
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
        return this.withPxeWrite("profileTx", network, async (pxe) => {
            return await pxe.profileTx(
                await TxExecutionRequest.schema.parseAsync(txRequest),
                {
                    profileMode: opts.profileMode,
                    skipProofGeneration: opts.skipProofGeneration,
                    scopes: await AccessScopesSchema.parseAsync(opts.scopes),
                },
            );
        });
    }

    public async getPrivateEvents(
        network: Network,
        eventSelector: EventSelector,
        filter: PrivateEventFilter,
    ): Promise<PackedPrivateEvent[]> {
        return this.withPxeWrite("getPrivateEvents", network, async (pxe) =>
            pxe.getPrivateEvents(
                await EventSelector.schema.parseAsync(eventSelector),
                await PrivateEventFilterSchema.parseAsync(filter),
            ),
        );
    }

    private async initKnown() {
        if (this.knownArtifacts.size) return;
        if (!this.initKnownPromise) {
            this.initKnownPromise = this.doInitKnown()
                .catch((err) => { this.initKnownPromise = null; throw err; });
        }
        await this.initKnownPromise;
    }

    private async doInitKnown() {
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
            // wonderland standards
            WonderlandTokenArtifact,
        ]) {
            const contractClass = await getContractClassFromArtifact(artifact);
            this.knownArtifacts.set(contractClass.id.toString(), artifact);
        }

        const sponsoredFpcInstance = await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
            salt: new Fr(SPONSORED_FPC_SALT),
        });
        this.knownInstances.set(sponsoredFpcInstance.address.toString(), sponsoredFpcInstance);
    }

    private async ensureChain(network: Network): Promise<void> {
        if (this.hasChain(network)) return;

        let promise = this.chainInitPromises.get(network.chainId);
        if (!promise) {
            promise = this.initChain(network)
                .then(() => { this.chainInitPromises.delete(network.chainId); })
                .catch((err) => {
                    this.chainInitPromises.delete(network.chainId);
                    throw err;
                });
            this.chainInitPromises.set(network.chainId, promise);
        }
        await promise;
    }

    private async withPxeRead<T>(label: string, network: Network, fn: (pxe: PXE, node: AztecNode) => Promise<T>): Promise<T> {
        const start = Date.now();
        try {
            await this.ensureChain(network);
            this.logDebug(`[DEBUG] [READ] ${label} starting`);
            const result = await this.guard.read(() =>
                fn(this.pxes.get(network.chainId)!, this.nodes.get(network.chainId)!),
            );
            this.logDebug(`[DEBUG] [READ] ${label} completed (${Date.now() - start}ms)`);
            return result;
        } catch (err) {
            this.logError(`[READ] ${label} failed after ${Date.now() - start}ms`, err instanceof Error ? err.message : String(err));
            throw err;
        }
    }

    private async withPxeWrite<T>(label: string, network: Network, fn: (pxe: PXE, node: AztecNode) => Promise<T>): Promise<T> {
        const start = Date.now();
        try {
            this.logDebug(`[DEBUG] [WRITE] ${label} waiting for lock`);
            return await this.guard.write(async () => {
                await this.ensureChain(network);
                this.logDebug(`[DEBUG] [WRITE] ${label} lock acquired, executing`);
                const result = await fn(this.pxes.get(network.chainId)!, this.nodes.get(network.chainId)!);
                this.logDebug(`[DEBUG] [WRITE] ${label} completed (${Date.now() - start}ms)`);
                return result;
            });
        } catch (err) {
            this.logError(`[WRITE] ${label} failed after ${Date.now() - start}ms`, err instanceof Error ? err.message : String(err));
            throw err;
        }
    }

    private hasChain(network: Network): boolean {
        return this.rpcs.get(network.chainId) === network.rpcUrl;
    }

    private async initChain(network: Network): Promise<void> {
        const node = createAztecNodeClient(network.rpcUrl, {}, makeFetchWithTimeout());
        const config = {
            ...getPXEConfig(),
            dataDirectory: `pxe/${network.profileId}/${network.chainId}`,
            proverEnabled: true,
        } as PXEConfig;

        const prover = new AcceleratorProver();
        const pxe = await createPXE(node, config, { proverOrOptions: prover });

        this.nodes.set(network.chainId, node);
        this.pxes.set(network.chainId, pxe);
        this.rpcs.set(network.chainId, network.rpcUrl);
    }

    private async fetchArtifactFromRegistry(network: Network, classId: Fr): Promise<ContractArtifact | undefined> {
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
            case 4138294185: // (11155111 ^ 4127419662) >>> 0
                return "https://testnet.aztec-registry.xyz";
            case 896946031: // (11155111 ^ 903641544) >>> 0 — v4-devnet-3
                return "https://devnet.aztec-registry.xyz";
            default:
                return undefined;
        }
    }

    private readonly onProfileDeleted = async (profile: ProfileInfo): Promise<void> => {
        try {
            await this.guard.enterWrite();
            this.nodes.clear();
            this.pxes.clear();
            this.rpcs.clear();
            this.chainInitPromises.clear();
            this.initKnownPromise = null;
            this.knownArtifacts.clear();
            this.knownInstances.clear();
            for (const db of await indexedDB.databases()) {
                if (db.name?.startsWith(`pxe/${profile.id}/`) || db.name === "keyval-store") {
                    const _ = indexedDB.deleteDatabase(db.name);
                }
            }
        } finally {
            this.guard.leaveWrite();
        }
    };

    private readonly onActiveProfileChanged = async (): Promise<void> => {
        try {
            await this.guard.enterWrite();
            this.nodes.clear();
            this.pxes.clear();
            this.rpcs.clear();
            this.chainInitPromises.clear();
        } finally {
            this.guard.leaveWrite();
        }
    };
}
