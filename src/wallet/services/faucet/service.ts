import { Fr } from "@aztec/foundation/curves/bn254";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { bufferAsFields } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    CONTRACT_CLASS_REGISTRY_CONTRACT_ADDRESS,
    CONTRACT_CLASS_REGISTRY_BYTECODE_CAPSULE_SLOT,
    CONTRACT_INSTANCE_REGISTRY_CONTRACT_ADDRESS,
    MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
} from "@aztec/constants";
import {
    getContractInstanceFromInstantiationParams,
    getContractClassFromArtifact,
    type ContractInstanceWithAddress,
} from "@aztec/stdlib/contract";
import { PublicKeys } from "@aztec/stdlib/keys";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { TransactionService, TxOrigin, OriginType } from "@/wallet/services/transaction/service";
import { NetworkService } from "@/wallet/services/network/service";
import { AccountService } from "@/wallet/services/account/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { TaskService, StepContent, TokenMintContent } from "@/wallet/services/task/service";
import {
    ExecutionService,
    type Operation,
    type Action,
    type OkOperationResult,
    type FeeSettings,
} from "@/wallet/services/execution/service";
import { jsonSanitize } from "@/wallet/utils/serialization";
import { FAUCET_SERVICE_NAME, Methods } from "./spec";

export * from "./spec";

export class FaucetService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = FAUCET_SERVICE_NAME;

    private pxeService: PxeServiceClient = null!;
    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private executionService: ExecutionService = null!;
    private transactionService: TransactionService = null!;
    private taskService: TaskService = null!;

    public constructor(logger: ILogger) {
        super(FAUCET_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.executionService = services.get(ExecutionService.name);
        this.transactionService = services.get(TransactionService.name);
        this.taskService = services.get(TaskService.name);
    }

    public async mint(
        networkId: string,
        accountAddress: string,
        name: string,
        symbol: string,
        decimals: number,
        amount: string,
        feeSettings: FeeSettings,
    ) {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }
        const network = await this.networkService.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id");
        }
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, accountAddress);
        if (!account) {
            throw new Error("unknown account");
        }
        const pxe = this.pxeService.getPXE(network);
        let deployActions: Action[];
        let deployOps: Operation[];
        let instance: ContractInstanceWithAddress;
        const origin: TxOrigin = { type: OriginType.UI, name: "Faucet" };

        const rootTask = this.taskService.startNewTask(
            new TokenMintContent(name, symbol, decimals, amount),
            undefined,
            origin,
        );
        const checkTask = rootTask.startSubtask(new StepContent("Check if need to deploy token"));
        try {
            deployActions = [];
            deployOps = [
                {
                    kind: "send_transaction",
                    networkId,
                    accountAddress,
                    feeSettings,
                    actions: deployActions,
                },
            ];

            const artifact = TokenContract.artifact;
            const contractClass = await getContractClassFromArtifact(artifact);
            instance = await getContractInstanceFromInstantiationParams(artifact, {
                constructorArgs: [accountAddress, name, symbol, decimals],
                publicKeys: PublicKeys.default(),
                salt: Fr.zero(),
            });

            const classMetadata = await pxe.getContractClassMetadata(contractClass.id, true);
            if (!classMetadata.isContractClassPubliclyRegistered) {
                this.logDebug("register faucet token class id");
                const { artifactHash, privateFunctionsRoot, publicBytecodeCommitment, packedBytecode } = contractClass;
                const encodedBytecode = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
                deployActions.push(
                    {
                        kind: "add_capsule",
                        contract: AztecAddress.fromNumber(CONTRACT_CLASS_REGISTRY_CONTRACT_ADDRESS).toString(),
                        storageSlot: new Fr(CONTRACT_CLASS_REGISTRY_BYTECODE_CAPSULE_SLOT).toString(),
                        capsule: encodedBytecode.map(x => x.toString()),
                    },
                    {
                        kind: "call",
                        contract: AztecAddress.fromNumber(CONTRACT_CLASS_REGISTRY_CONTRACT_ADDRESS).toString(),
                        method: "publish",
                        args: [artifactHash, privateFunctionsRoot, publicBytecodeCommitment],
                    },
                );
            }

            const contractMetadata = await pxe.getContractMetadata(instance.address);
            if (!contractMetadata.isContractPublished) {
                this.logDebug("deploy faucet token");
                const { salt, currentContractClassId, initializationHash, publicKeys } = instance;
                deployActions.push({
                    kind: "call",
                    contract: AztecAddress.fromNumber(CONTRACT_INSTANCE_REGISTRY_CONTRACT_ADDRESS).toString(),
                    method: "publish_for_public_execution",
                    args: [salt, currentContractClassId, initializationHash, publicKeys, true],
                });
            }

            if (!contractMetadata.isContractInitialized) {
                this.logDebug("initialize faucet token");
                deployOps.unshift({
                    kind: "register_contract",
                    networkId,
                    address: instance.address.toString(),
                    instance: jsonSanitize(instance),
                    artifact: jsonSanitize(artifact),
                });
                deployActions.push({
                    kind: "call",
                    contract: instance.address.toString(),
                    method: "constructor",
                    args: [accountAddress, name, symbol, decimals],
                });
            }
            checkTask.complete();
        } catch (error) {
            checkTask.fail(error);
            rootTask.fail(error);
            throw error;
        }

        if (deployActions.length) {
            const deployTask = rootTask.startSubtask(new StepContent("Deploying token"));

            try {
                const deployResults = await this.executionService.executeOperations(deployOps, origin, deployTask);
                if (!deployResults.every(x => x.status === "ok")) {
                    throw new Error(
                        `Token deployment failed: ${deployResults.find(x => x.status === "failed")?.error}`,
                    );
                }
                const deployTx = (deployResults.at(-1) as OkOperationResult<string>).result;
                this.logDebug("faucet deploy tx", deployTx);
                await this.transactionService.waitForTx(deployTx, deployTask);
                this.logDebug("faucet deploy tx mined");
                if (feeSettings.paymentMethod.kind === "fjwc") {
                    feeSettings = {
                        ...feeSettings,
                        paymentMethod: { kind: "fj" },
                    };
                }
                deployTask.complete();
            } catch (error) {
                deployTask.fail(error);
                rootTask.fail(error);
                throw error;
            }
        }

        const mintTask = rootTask.startSubtask(new StepContent("Minting token"));
        try {
            const [mintResult, registerResult] = await this.executionService.executeOperations(
                [
                    {
                        kind: "send_transaction",
                        networkId,
                        accountAddress,
                        feeSettings,
                        actions: [
                            {
                                kind: "call",
                                contract: instance.address.toString(),
                                method: "mint_to_private",
                                args: [accountAddress, amount],
                            },
                            {
                                kind: "call",
                                contract: instance.address.toString(),
                                method: "mint_to_public",
                                args: [accountAddress, amount],
                            },
                        ],
                    },
                    {
                        kind: "register_token",
                        networkId,
                        accountAddress,
                        address: instance.address.toString(),
                    },
                ],
                origin,
                mintTask,
            );
            if (mintResult.status === "failed") {
                throw new Error(`Token mint failed: ${mintResult.error}`);
            }
            if (registerResult.status === "failed") {
                throw new Error(`Token register failed: ${registerResult.error}`);
            }
            const mintTx = (mintResult as OkOperationResult<string>).result;
            this.logDebug("faucet mint tx:", mintTx);
            await this.transactionService.waitForTx(mintTx, mintTask);
            this.logDebug("faucet mint tx mined");
            mintTask.complete();
        } catch (error) {
            mintTask.fail(error);
            rootTask.fail(error);
            throw error;
        }
        rootTask.complete();
    }
}
