import { Fr } from "@aztec/foundation/fields"
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { bufferAsFields } from "@aztec/stdlib/abi"
import { AztecAddress } from "@aztec/stdlib/aztec-address"
import { 
    DEPLOYER_CONTRACT_ADDRESS,
    MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
    REGISTERER_CONTRACT_ADDRESS,
    REGISTERER_CONTRACT_BYTECODE_CAPSULE_SLOT,
 } from "@aztec/constants"
import {
    getContractInstanceFromDeployParams,
    getContractClassFromArtifact,
} from "@aztec/stdlib/contract"
import { PublicKeys } from "@aztec/stdlib/keys"
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import type { TokenService } from "@/wallet/services/token"
import type { TransactionService } from "@/wallet/services/transaction"
import type { NetworkService } from "@/wallet/services/network"
import type { AccountService } from "@/wallet/services/account"
import type { ProfileService } from "@/wallet/services/profile"
import type { PxeService } from "@/wallet/services/pxe";
import type { ExecutionService } from "@/wallet/services/execution"
import {
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
} from "@/wallet/services/execution/client"
import { jsonSanitize } from "@/wallet/utils/serialization";
import {
	FaucetServiceMethod,
    FAUCET_SERVICE_NAME,
    type MintRequest,
    MintResponse,
} from "./client"

export class FaucetService extends Service {
	constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        private readonly pxeService: PxeService,
        private readonly accountService: AccountService,
        private readonly executionService: ExecutionService,
        private readonly transactionService: TransactionService,
        private readonly tokenService: TokenService,
        emit: (event: EventMessage) => void
    ) {
		super(FAUCET_SERVICE_NAME, emit)
	}

	public async process(
		request: RequestMessage
	): Promise<ResponseMessage | undefined> {
		switch (request.method) {
			case FaucetServiceMethod.Mint: {
				const _request = request as MintRequest
				try {
					await this.mint(
                        _request.network,
                        _request.account,
                        _request.name,
                        _request.symbol,
                        _request.decimals,
                        _request.amount,
                        _request.feeSettings,
                    );
					return new MintResponse(_request);
				} catch (error: any) {
					return new MintResponse(
						_request,
						error.message
					)
				}
			}
			default: {
				console.error(`Invalid request method ${request.method}.`)
				return undefined
			}
		}
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
            throw new Error("Profile locked")
        }
        const network = await this.networkService.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id")
        }
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, accountAddress);
        if (!account) {
            throw new Error("unknown account")
        }
        const pxe = await this.pxeService.getPXEClient(network.chainId);
        
        const deployActions: IAction[] = [];
        const deployOps: IOperation[] = [
            new SendTransactionOperation(networkId, accountAddress, feeSettings, deployActions)
        ];
        
        const artifact = TokenContract.artifact;
        const contractClass = await getContractClassFromArtifact(artifact);
        const instance = await getContractInstanceFromDeployParams(
            artifact,
            {
                constructorArgs: [
                    accountAddress,
                    name,
                    symbol,
                    decimals,
                ],
                publicKeys: PublicKeys.default(),
                salt: Fr.zero(),
            },
        );

        const classMetadata = await pxe.getContractClassMetadata(contractClass.id);
        if (!classMetadata.isContractClassPubliclyRegistered) {
            console.debug("register faucet token class id");
            const { artifactHash, privateFunctionsRoot, publicBytecodeCommitment, packedBytecode } = contractClass;
            const encodedBytecode = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
            deployActions.push(
                new AddCapsuleAction(
                    AztecAddress.fromNumber(REGISTERER_CONTRACT_ADDRESS).toString(),
                    new Fr(REGISTERER_CONTRACT_BYTECODE_CAPSULE_SLOT).toString(),
                    encodedBytecode.map(x => x.toString()),
                ),
                new CallAction(
                    AztecAddress.fromNumber(REGISTERER_CONTRACT_ADDRESS).toString(),
                    "register",
                    [
                        artifactHash,
                        privateFunctionsRoot,
                        publicBytecodeCommitment,
                        true,
                    ],
                )
            );
        }

        const contractMetadata = await pxe.getContractMetadata(instance.address);
        if (!contractMetadata.isContractPubliclyDeployed) {
            console.debug("deploy faucet token");
            const {salt, currentContractClassId, initializationHash, publicKeys} = instance;
            deployActions.push(
                new CallAction(
                    AztecAddress.fromNumber(DEPLOYER_CONTRACT_ADDRESS).toString(), // ContractInstanceDeployer
                    "deploy",
                    [
                        salt,
                        currentContractClassId,
                        initializationHash,
                        publicKeys,
                        true,
                    ],
                )
            );
        }

        if (!contractMetadata.isContractInitialized) {
            console.debug("initialize faucet token");
            deployOps.unshift(
                new RegisterContractOperation(
                    networkId,
                    instance.address.toString(),
                    jsonSanitize(instance),
                    jsonSanitize(artifact),
                )
            );
            deployActions.push(
                new CallAction(
                    instance.address.toString(),
                    "constructor",
                    [
                        accountAddress,
                        name,
                        symbol,
                        decimals,
                    ],
                )
            );
        }
        
        if (deployActions.length) {
            const deployResults = await this.executionService.executeOperations(deployOps, "Faucet");
            if (!deployResults.every(x => x.status === OperationStatus.Ok)) {
                throw new Error(`Token deployment failed: ${
                    (deployResults.find(x => x.status === OperationStatus.Failed) as FailedOperationResult)?.error
                }`);
            }
            const deployTx = (deployResults.at(-1) as OkOperationResult<string>).result;
            console.debug("faucet deploy tx:", deployTx);
            await this.transactionService.waitForTx(deployTx);
            console.debug("faucet deploy tx mined");
        }

        const [mintResult] = await this.executionService.executeOperations(
            [
                new SendTransactionOperation(networkId, accountAddress, feeSettings, [
                    new CallAction(
                        instance.address.toString(),
                        "mint_to_private",
                        [accountAddress, accountAddress, amount],
                    ),
                    new CallAction(
                        instance.address.toString(),
                        "mint_to_public",
                        [accountAddress, amount],
                    ),
                ]),
            ],
            "Faucet"
        );
        if (mintResult.status !== OperationStatus.Ok) {
            throw new Error(`Token mint failed: ${
                (mintResult as FailedOperationResult)?.error
            }`);
        }
        const mintTx = (mintResult as OkOperationResult<string>).result;
        console.debug("faucet mint tx:", mintTx);
        await this.transactionService.waitForTx(mintTx);
        console.debug("faucet mint tx mined");

        const tokens = await this.tokenService.getTokens(profile.id, network.chainId);
        if (!tokens.some(x => x.contract === instance.address.toString())) {
            console.debug("adding faucet token...");
            const ti = await this.tokenService.parseTokenInterface(
                networkId,
                instance.address.toString(),
            );
            const token = await this.tokenService.addToken(profile.id, networkId, accountAddress, ti);
            console.debug("faucet token:", token);
        }
    }
}
