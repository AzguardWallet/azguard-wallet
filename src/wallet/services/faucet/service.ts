import { Fr } from "@aztec/foundation/fields";
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { bufferAsFields } from "@aztec/stdlib/abi";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    DEPLOYER_CONTRACT_ADDRESS,
    MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
    REGISTERER_CONTRACT_ADDRESS,
    REGISTERER_CONTRACT_BYTECODE_CAPSULE_SLOT,
} from "@aztec/constants";
import {
    getContractInstanceFromDeployParams,
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
    type IOperation,
    RegisterContractOperation,
    SendTransactionOperation,
    type IAction,
    AddCapsuleAction,
    CallAction,
    OperationStatus,
    type OkOperationResult,
    type FailedOperationResult,
    type FeeSettings,
    FeePaymentMethodType,
    FeeJuicePaymentMethod,
    RegisterTokenOperation,
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
        let deployActions: IAction[];
        let deployOps: IOperation[];
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
            deployOps = [new SendTransactionOperation(networkId, accountAddress, feeSettings, deployActions)];

            const artifact = TokenContract.artifact;
            const contractClass = await getContractClassFromArtifact(artifact);
            instance = await getContractInstanceFromDeployParams(artifact, {
                constructorArgs: [accountAddress, name, symbol, decimals],
                publicKeys: PublicKeys.default(),
                salt: Fr.zero(),
            });

            const classMetadata = await pxe.getContractClassMetadata(contractClass.id);
            if (!classMetadata.isContractClassPubliclyRegistered) {
                this.logDebug("register faucet token class id");
                const { artifactHash, privateFunctionsRoot, publicBytecodeCommitment, packedBytecode } = contractClass;
                const encodedBytecode = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
                deployActions.push(
                    new AddCapsuleAction(
                        AztecAddress.fromNumber(REGISTERER_CONTRACT_ADDRESS).toString(),
                        new Fr(REGISTERER_CONTRACT_BYTECODE_CAPSULE_SLOT).toString(),
                        encodedBytecode.map(x => x.toString()),
                    ),
                    new CallAction(AztecAddress.fromNumber(REGISTERER_CONTRACT_ADDRESS).toString(), "register", [
                        artifactHash,
                        privateFunctionsRoot,
                        publicBytecodeCommitment,
                        true,
                    ]),
                );
            }

            const contractMetadata = await pxe.getContractMetadata(instance.address);
            if (!contractMetadata.isContractPubliclyDeployed) {
                this.logDebug("deploy faucet token");
                const { salt, currentContractClassId, initializationHash, publicKeys } = instance;
                deployActions.push(
                    new CallAction(
                        AztecAddress.fromNumber(DEPLOYER_CONTRACT_ADDRESS).toString(), // ContractInstanceDeployer
                        "deploy",
                        [salt, currentContractClassId, initializationHash, publicKeys, true],
                    ),
                );
            }

            if (!contractMetadata.isContractInitialized) {
                this.logDebug("initialize faucet token");
                deployOps.unshift(
                    new RegisterContractOperation(
                        networkId,
                        instance.address.toString(),
                        jsonSanitize(instance),
                        jsonSanitize(artifact),
                    ),
                );
                deployActions.push(
                    new CallAction(instance.address.toString(), "constructor", [
                        accountAddress,
                        name,
                        symbol,
                        decimals,
                    ]),
                );
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
                if (!deployResults.every(x => x.status === OperationStatus.Ok)) {
                    throw new Error(
                        `Token deployment failed: ${
                            (deployResults.find(x => x.status === OperationStatus.Failed) as FailedOperationResult)
                                ?.error
                        }`,
                    );
                }
                const deployTx = (deployResults.at(-1) as OkOperationResult<string>).result;
                this.logDebug("faucet deploy tx", deployTx);
                await this.transactionService.waitForTx(deployTx, deployTask);
                this.logDebug("faucet deploy tx mined");
                if (feeSettings.paymentMethod.type === FeePaymentMethodType.FeeJuiceWithClaim) {
                    feeSettings = {
                        ...feeSettings,
                        paymentMethod: new FeeJuicePaymentMethod(),
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
                    new SendTransactionOperation(networkId, accountAddress, feeSettings, [
                        new CallAction(instance.address.toString(), "mint_to_private", [
                            accountAddress,
                            accountAddress,
                            amount,
                        ]),
                        new CallAction(instance.address.toString(), "mint_to_public", [accountAddress, amount]),
                    ]),
                    new RegisterTokenOperation(networkId, accountAddress, instance.address.toString()),
                ],
                origin,
                mintTask,
            );
            if (mintResult.status !== OperationStatus.Ok) {
                throw new Error(`Token mint failed: ${(mintResult as FailedOperationResult)?.error}`);
            }
            if (registerResult.status !== OperationStatus.Ok) {
                throw new Error(`Token register failed: ${(registerResult as FailedOperationResult)?.error}`);
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
