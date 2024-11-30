import {
    AztecAddress,
    computeInnerAuthWitHash,
    computeAuthWitMessageHash,
    createPXEClient, 
    ExtendedNote,
    Fr,
    PackedValues,
    PXE,
    FunctionCall,
    ContractInstanceWithAddress,
} from "@aztec/aztec.js";
import {
    ContractArtifact,
    encodeArguments,
    FunctionSelector,
    FunctionType,
} from "@aztec/foundation/abi";
import {
    EventMessage,
    RequestMessage,
    ResponseMessage,
} from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import { NetworkService } from "@/wallet/services/network";
import { AccountService } from "@/wallet/services/account";
import { AzguardFunctionCall } from "@/wallet/services/account/contracts";
import { ProfileService } from "@/wallet/services/profile";
import { TokenService } from "@/wallet/services/token";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "@/wallet/services/token/functions";
import { TransactionService } from "@/wallet/services/transaction";
import {
    OriginType,
    TransferToken,
    TransferType,
    TxCall,
    TxOrigin,
    TxTransfer,
} from "@/wallet/services/transaction/client";
import { getAuthRegistryAddress, getSetAuthorizedFn, getSetAuthorizedSelector } from "@/wallet/utils/auth-registry";
import { Fn } from "@/wallet/utils/fn";
import {
    ActionType,
    AddCapsuleAction,
    AddNoteAction,
    AddContactAction,
    AuthorizeCallAction,
    AuthorizeIntentAction,
    CallAction,
    ExecuteBatchRequest,
    ExecuteBatchResponse,
    ExecuteTransferRequest,
    ExecuteTransferResponse,
    EXECUTION_SERVICE_NAME,
    ExecutionServiceMethod,
    IAction,
    AddContractAction,
} from "./client";

export class ExecutionService extends Service {
    constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        private readonly accountService: AccountService,
        private readonly tokenService: TokenService,
        private readonly transactionService: TransactionService,
        emit: (event: EventMessage) => void,
    ) {
        super(EXECUTION_SERVICE_NAME, emit);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case ExecutionServiceMethod.ExecuteBatch: {
                const _request = request as ExecuteBatchRequest;
                try {
                    const txHash = await this.executeBatch(
                        _request.network,
                        _request.account,
                        _request.dappName,
                        _request.actions,
                    );
                    return new ExecuteBatchResponse(_request, txHash);
                }
                catch (error: any) {
                    return new ExecuteBatchResponse(_request, undefined, error.message);
                }
            }
            case ExecutionServiceMethod.ExecuteTransfer: {
                const _request = request as ExecuteTransferRequest;
                try {
                    const txHash = await this.executeTransfer(
                        _request.network,
                        _request.account,
                        _request.token,
                        _request.transferType,
                        _request.recipient,
                        BigInt(_request.amount),
                    );
                    return new ExecuteTransferResponse(_request, txHash);
                }
                catch (error: any) {
                    return new ExecuteTransferResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }                
        }
    }
    
    public async executeAndWait(
        networkId: string,
        accountAddress: string,
        dappName: string,
        actions: IAction[],
    ): Promise<string> {
        const tx = await this.executeBatch(
            networkId,
            accountAddress,
            dappName,
            actions,
        );
        await this.transactionService.waitForTx(tx);
        return tx;
    }

    public async executeBatch(
        networkId: string,
        accountAddress: string,
        dappName: string,
        actions: IAction[],
    ): Promise<string> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Unauthorized");
        }
        const network = await this.networkService.getNetwork(networkId);
        if (!network) {
            throw new Error("Unknown network");
        }
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, accountAddress);

        const pxe = createPXEClient(network.rpcUrl);
        const instances = await this.prepareInstances(pxe, actions);
        const artifacts = await this.prepareArtifacts(pxe, actions, instances);

        const registeredContracts = new Set<string>((await pxe.getContracts()).map(x => x.toString()));
        for (const [contract, instance] of instances) {
            if (!registeredContracts.has(contract)) {
                console.debug("Register contract");
                await pxe.registerContract({
                    instance,
                    artifact: artifacts.get(instance.contractClassId.toString()),
                });
            }
        }
        
        const args = [];
        const calls = [];
        const txCalls = [];
        for (const action of actions) {
            switch (action.type) {
                case ActionType.AddCapsule: {
                    const _action = (action as AddCapsuleAction)!;
                    console.debug(`Adding capsule from ${dappName}...`);
                    await pxe.addCapsule(_action.capsule.map(Fr.fromString));
                    console.debug(`Capsule from ${dappName} added.`);
                    break;
                }
                case ActionType.AddNote: {
                    const _action = (action as AddNoteAction)!;
                    console.debug(`Adding note from ${dappName}...`);
                    await pxe.addNote(ExtendedNote.fromString(_action.note), account.address);
                    console.debug(`Note from ${dappName} added.`);
                    break;
                }
                case ActionType.AddContact: {
                    const _action = (action as AddContactAction)!;
                    console.debug(`Adding contact from ${dappName}...`);
                    await pxe.registerContact(AztecAddress.fromString(_action.address));
                    console.debug(`Contact from ${dappName} added.`);
                    break;
                }
                case ActionType.AddContract: {
                    // contracts are registered above
                    break;
                }
                case ActionType.AuthorizeCall: {
                    const _action = (action as AuthorizeCallAction)!;
                    const instance = instances.get(_action.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.contractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract not found");
                    }
                    const fn = artifact.functions.find(x => x.name === _action.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    const messageHash = computeAuthWitMessageHash(
                        {
                            caller: AztecAddress.fromString(_action.caller),
                            action: new FunctionCall(
                                fn.name,
                                AztecAddress.fromString(_action.contract),
                                FunctionSelector.fromNameAndParameters(fn.name, fn.parameters),
                                fn.functionType,
                                fn.isStatic,
                                encodeArguments(fn, _action.args),
                                fn.returnTypes,
                            ),
                        },
                        {
                            chainId: new Fr(network.chainId),
                            version: new Fr(network.protocolVersion),
                        },
                    );
                    if (_action.registry) {
                        const fn = getSetAuthorizedFn();
                        const packedArgs = PackedValues.fromValues(encodeArguments(fn, [messageHash, true]));
                        args.push(packedArgs);
                        calls.push(new AzguardFunctionCall(
                            getAuthRegistryAddress(),
                            getSetAuthorizedSelector(),
                            packedArgs.hash,
                            fn.functionType === FunctionType.PUBLIC,
                            fn.isStatic,
                        ));
                        txCalls.push(new TxCall(
                            getAuthRegistryAddress().toString(),
                            fn.name,
                            [messageHash, true],
                        ));
                        console.debug(`Call to authwit registry from ${dappName} enqueued.`);
                    }
                    else {
                        console.debug(`Adding call authwit from ${dappName}...`);
                        const authwit = await account.buildAuthWitness(messageHash);
                        await pxe.addAuthWitness(authwit);
                        console.debug(`Call authwit from ${dappName} added.`);
                    }
                    break;
                }
                case ActionType.AuthorizeIntent: {
                    const _action = (action as AuthorizeIntentAction)!;
                    const messageHash = computeAuthWitMessageHash(
                        {
                            consumer: AztecAddress.fromString(_action.consumer),
                            innerHash: computeInnerAuthWitHash(_action.intent.map(x => Fr.fromString(x))),
                        },
                        {
                            chainId: new Fr(network.chainId),
                            version: new Fr(network.protocolVersion),
                        },
                    );
                    if (_action.registry) {
                        const fn = getSetAuthorizedFn();
                        const packedArgs = PackedValues.fromValues(encodeArguments(fn, [messageHash, true]));
                        args.push(packedArgs);
                        calls.push(new AzguardFunctionCall(
                            getAuthRegistryAddress(),
                            getSetAuthorizedSelector(),
                            packedArgs.hash,
                            fn.functionType === FunctionType.PUBLIC,
                            fn.isStatic,
                        ));
                        txCalls.push(new TxCall(
                            getAuthRegistryAddress().toString(),
                            fn.name,
                            [messageHash, true],
                        ));
                        console.debug(`Call to authwit registry from ${dappName} enqueued.`);
                    }
                    else {
                        console.debug(`Adding intent authwit from ${dappName}...`);
                        const authwit = await account.buildAuthWitness(messageHash);
                        await pxe.addAuthWitness(authwit);
                        console.debug(`Intent authwit from ${dappName} added.`);
                    }
                    break;
                }
                case ActionType.Call: {
                    const _action = (action as CallAction)!;
                    const instance = instances.get(_action.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.contractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract not found");
                    }
                    const fn = artifact.functions.find(x => x.name === _action.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    const fnSelector = FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                    const packedArgs = PackedValues.fromValues(encodeArguments(fn, _action.args));
                    args.push(packedArgs);
                    calls.push(new AzguardFunctionCall(
                        AztecAddress.fromString(_action.contract),
                        fnSelector,
                        packedArgs.hash,
                        fn.functionType === FunctionType.PUBLIC,
                        fn.isStatic,
                    ));
                    txCalls.push(new TxCall(
                        _action.contract,
                        _action.method,
                        _action.args,
                    ));
                    console.debug(`Call from ${dappName} enqueued.`);
                    break;
                }
            }
        }
        const nonce = Fr.random();

        const txRequest = await account.buildTxExecutionRequest(pxe, calls, args, nonce);
        const simulatedTx = await pxe.simulateTx(txRequest, true);
        const provedTx = await pxe.proveTx(txRequest, simulatedTx.privateExecutionResult);
        const txHash = await pxe.sendTx(provedTx.toTx());

        const tx = await this.transactionService.addTransaction(
            new TxOrigin(OriginType.DAPP, dappName),
            network.chainId,
            accountAddress,
            [],
            txCalls,
            nonce.toString(),
            txHash.toString(),
        );

        return tx.hash;
    }

    public async executeTransfer(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
    ): Promise<string> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Unauthorized");
        }
        const network = await this.networkService.getNetwork(networkId);
        if (!network) {
            throw new Error("Unknown network");
        }
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, accountAddress);
        const token = await this.tokenService.getTokenRaw(tokenId);
        
        let fn: Fn;
        let args: any[];
        switch (transferType) {
            case TransferType.Private: {
                if (!token.transferPrivateFn) {
                    throw new Error("Transfer type not supported");
                }
                fn = TransferPrivateFn.new(
                    token.transferPrivateFn.name,
                    token.transferPrivateFn.impl,
                );
                args = (fn as TransferPrivateFn).buildArgs(
                    accountAddress,
                    recipientAddress,
                    amount,
                );
                break;
            }
            case TransferType.PrivateToPublic: {
                if (!token.transferPrivateToPublicFn) {
                    throw new Error("Transfer type not supported");
                }
                fn = TransferPrivateToPublicFn.new(
                    token.transferPrivateToPublicFn.name,
                    token.transferPrivateToPublicFn.impl,
                );
                args = (fn as TransferPrivateToPublicFn)?.buildArgs(
                    accountAddress,
                    recipientAddress,
                    amount,
                );
                break;
            }
            case TransferType.Public: {
                if (!token.transferPublicFn) {
                    throw new Error("Transfer type not supported");
                }
                fn = TransferPublicFn.new(
                    token.transferPublicFn.name,
                    token.transferPublicFn.impl,
                );
                args = (fn as TransferPublicFn)?.buildArgs(
                    accountAddress,
                    recipientAddress,
                    amount,
                );
                break;
            }
            case TransferType.PublicToPrivate: {
                if (!token.transferPublicToPrivateFn) {
                    throw new Error("Transfer type not supported");
                }
                fn = TransferPublicToPrivateFn.new(
                    token.transferPublicToPrivateFn.name,
                    token.transferPublicToPrivateFn.impl,
                );
                args = (fn as TransferPublicToPrivateFn)?.buildArgs(
                    accountAddress,
                    recipientAddress,
                    amount,
                );
                break;
            }
            default:
                throw new Error("Invalid transfer type");
        }
        const packedArgs = fn.packArgs(args);
        const call = new AzguardFunctionCall(
            AztecAddress.fromString(token.contract),
            fn.selector,
            packedArgs.hash,
            fn.type === FunctionType.PUBLIC,
            fn.isStatic,
        );
        const nonce = Fr.random();

        const pxe = createPXEClient(network.rpcUrl);
        const txRequest = await account.buildTxExecutionRequest(pxe, [call], [packedArgs], nonce);
        const simulatedTx = await pxe.simulateTx(txRequest, true);
        const provedTx = await pxe.proveTx(txRequest, simulatedTx.privateExecutionResult);
        const txHash = await pxe.sendTx(provedTx.toTx());

        const tx = await this.transactionService.addTransaction(
            new TxOrigin(OriginType.UI),
            network.chainId,
            accountAddress,
            [],
            [
                new TxCall(
                    token.contract,
                    fn.name,
                    args.map(x => x.toString()),
                    [
                        new TxTransfer(
                            new TransferToken(token.name, token.symbol, token.decimals),
                            transferType,
                            accountAddress,
                            recipientAddress,
                            amount.toString(),
                        )
                    ]
                ),
            ],
            nonce.toString(),
            txHash.toString(),
        );

        return tx.hash;
    }

    private async prepareInstances(pxe: PXE, actions: IAction[]): Promise<Map<string, ContractInstanceWithAddress>> {
        console.debug("Prepare instances...");
        const instances = new Map<string, ContractInstanceWithAddress>();
        for (const action of actions.filter(x => x.type === ActionType.AddContract)) {
            const _action = action as AddContractAction;
            if (_action.instance) {
                instances.set(_action.address, _action.instance as ContractInstanceWithAddress);
            }
        }
        console.debug(`${instances.size} instances provided`);
        const contracts = new Set(
            actions
                .filter(x => 
                    x.type === ActionType.AddContract ||
                    x.type === ActionType.AuthorizeCall ||
                    x.type === ActionType.Call
                )
                .map(x => 
                    (x as AddContractAction)?.address ??
                    (x as AuthorizeCallAction)?.contract ??
                    (x as CallAction).contract
                )
                .filter(x => !instances.has(x))
        );
        console.debug(`Fetching ${contracts.size} instances...`);
        const fetched = await Promise.all(
            contracts.values().map(x => this.getInstance(pxe, x)),
        );
        console.debug(`${fetched.length} instances fetched`);
        for (const [address, instance] of fetched) {
            instances.set(address, instance);
        }
        return instances;
    }

    private async getInstance(pxe: PXE, contract: string): Promise<[string, ContractInstanceWithAddress]> {
        const instance = await pxe.getContractInstance(AztecAddress.fromString(contract));
        if (!instance) {
            throw new Error("Contract instance not found");
        }
        return [contract, instance];
    }

    private async prepareArtifacts(pxe: PXE, actions: IAction[], instances: Map<string, ContractInstanceWithAddress>): Promise<Map<string, ContractArtifact>> {
        console.debug("Prepare artifacts...");
        const artifacts = new Map<string, ContractArtifact>();
        for (const action of actions.filter(x => x.type === ActionType.AddContract)) {
            const _action = action as AddContractAction;
            if (_action.artifact) {
                const instance = instances.get(_action.address)!;
                artifacts.set(instance.contractClassId.toString(), _action.artifact as ContractArtifact);
            }
        }
        console.debug(`${artifacts.size} artifacts provided`);
        const classIds = new Set(
            instances
                .values()
                .filter(x => !artifacts.has(x.contractClassId.toString()))
                .map(x => x.contractClassId.toString())
        );
        console.debug(`Fetching ${classIds.size} artifacts...`);
        const fetched = await Promise.all(
            classIds.values().map(x => this.getArtifact(pxe, x))
        );
        console.debug(`${fetched.length} artifacts fetched`);
        for (const [classId, artifact] of fetched) {
            artifacts.set(classId, artifact);
        }
        return artifacts;
    }

    private async getArtifact(
        pxe: PXE,
        classId: string,
    ): Promise<[string, ContractArtifact]> {
        const artifact = await pxe.getContractArtifact(Fr.fromString(classId));
        if (!artifact) {
            throw new Error("Contract artifact not found");
        }
        return [classId, artifact];
    }
}