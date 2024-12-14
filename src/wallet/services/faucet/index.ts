import {
	EventMessage,
	RequestMessage,
	ResponseMessage,
} from "@/wallet/base/messages"
import { Service } from "@/wallet/base/service"
import {
	FaucetServiceMethod,
    FAUCET_SERVICE_NAME,
    MintRequest,
    MintResponse,
} from "./client"
import { ExecutionService } from "../execution"
import { TokenService } from "../token"
import { createPXEClient, getContractClassFromArtifact } from "@aztec/aztec.js"

import { bufferAsFields } from "@aztec/foundation/abi"
import {
    AztecAddress,
    Fr,
    getContractInstanceFromDeployParams,
    MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS,
    PublicKeys,
} from "@aztec/circuits.js"
import { NetworkService } from "../network"
import { AccountService } from "../account"
import { ProfileService } from "../profile"
import { AddCapsuleAction, AddContractAction, CallAction } from "../execution/client"
import { TokenContract } from "@aztec/noir-contracts.js";

export class FaucetService extends Service {
	constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        private readonly accountService: AccountService,
        private readonly executionService: ExecutionService,
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
            
        const actions = [];
        const artifact = TokenContract.artifact;
        const contractClass = getContractClassFromArtifact(artifact);
        const instance = getContractInstanceFromDeployParams(
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

        if (!await pxe.isContractClassPubliclyRegistered(contractClass.id)) {
            console.debug("register faucet token class id");
            const { artifactHash, privateFunctionsRoot, publicBytecodeCommitment, packedBytecode } = contractClass;
            const encodedBytecode = bufferAsFields(packedBytecode, MAX_PACKED_PUBLIC_BYTECODE_SIZE_IN_FIELDS);
            actions.push(new AddCapsuleAction(
                encodedBytecode.map(x => x.toString()),
            ));
            actions.push(new CallAction(
                AztecAddress.fromBigInt(3n).toString(), // ContractClassRegisterer
                "register",
                [
                    artifactHash.toString(),
                    privateFunctionsRoot.toString(),
                    publicBytecodeCommitment.toString(),
                ],
            ));
        }

        if (!await pxe.isContractPubliclyDeployed(instance.address)) {
            console.debug("deploy faucet token");
            const {salt, contractClassId, initializationHash, publicKeys} = instance;
            actions.push(new CallAction(
                AztecAddress.fromBigInt(2n).toString(), // ContractInstanceDeployer
                "deploy",
                [
                    salt,
                    contractClassId,
                    initializationHash,
                    publicKeys,
                    true,
                ],
            ));
        }

        if (!await pxe.isContractInitialized(instance.address)) {
            console.debug("initialize faucet token");
            actions.push(new AddContractAction(
                instance.address.toString(),
                instance,
                artifact,
            ));
            actions.push(new CallAction(
                instance.address.toString(),
                "constructor",
                [
                    accountAddress,
                    name,
                    symbol,
                    decimals,
                ],
            ));
        }
        
        if (actions.length) {
            const initTx = await this.executionService.executeAndWait(
                networkId,
                accountAddress,
                "Faucet",
                actions,
            );
            console.debug("faucet init tx:", initTx);
        }

        const mintTx = await this.executionService.executeAndWait(
            networkId,
            accountAddress,
            "Faucet",
            [
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
            ]
        );
        console.debug("faucet mint tx:", mintTx);

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
