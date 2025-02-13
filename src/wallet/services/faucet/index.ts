import { createPXEClient, getContractClassFromArtifact } from "@aztec/aztec.js"
import { bufferAsFields } from "@aztec/foundation/abi"
import {
    AztecAddress,
    Fr,
    getContractInstanceFromDeployParams,
    MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
    REGISTERER_CONTRACT_ADDRESS,
    REGISTERER_CONTRACT_BYTECODE_CAPSULE_SLOT,
    PublicKeys,
} from "@aztec/circuits.js"
import { TokenContract } from "@aztec/noir-contracts.js/Token";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import { TokenService } from "@/wallet/services/token"
import { TransactionService } from "@/wallet/services/transaction"
import { NetworkService } from "@/wallet/services/network"
import { AccountService } from "@/wallet/services/account"
import { ProfileService } from "@/wallet/services/profile"
import { ExecutionService } from "@/wallet/services/execution"
import {
    IOperation,
    RegisterContractOperation,
    SendTransactionOperation,
    IAction,
    AddCapsuleAction,
    CallAction,
    OperationStatus,
    OkOperationResult,
    FailedOperationResult,
} from "@/wallet/services/execution/client"
import {
	FaucetServiceMethod,
    FAUCET_SERVICE_NAME,
    MintRequest,
    MintResponse,
} from "./client"

export class FaucetService extends Service {
	constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
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
    ) {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("unauthorized")
        }
        const network = await this.networkService.getNetwork(networkId);
        if (!network) {
            throw new Error("unknown network id")
        }
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, accountAddress);
        if (!account) {
            throw new Error("unknown account")
        }
        const pxe = createPXEClient(network.rpcUrl);
        
        const deployActions: IAction[] = [];
        const deployOps: IOperation[] = [
            new SendTransactionOperation(networkId, accountAddress, deployActions)
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
                        artifactHash.toString(),
                        privateFunctionsRoot.toString(),
                        publicBytecodeCommitment.toString(),
                        true,
                    ],
                )
            );
        }

        const contractMetadata = await pxe.getContractMetadata(instance.address);
        if (!contractMetadata.isContractPubliclyDeployed) {
            console.debug("deploy faucet token");
            const {salt, contractClassId, initializationHash, publicKeys} = instance;
            deployActions.push(
                new CallAction(
                    AztecAddress.fromBigInt(2n).toString(), // ContractInstanceDeployer
                    "deploy",
                    [
                        salt,
                        contractClassId,
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
                    instance,
                    artifact,
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
                new SendTransactionOperation(networkId, accountAddress, [
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
