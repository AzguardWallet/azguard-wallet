import {
    AztecAddress,
    createPXEClient, 
    ExtendedNote,
    Fr,
    Note,
    PackedValues,
    PXE,
    TxHash,
} from "@aztec/aztec.js";
import { ContractArtifact, encodeArguments, FunctionSelector, FunctionType, NoteSelector } from "@aztec/foundation/abi";
import { poseidon2Hash } from "@aztec/foundation/crypto";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/messages";
import { Service } from "@/wallet/base/service";
import {
    ActionType,
    AddCapsuleAction,
    AddNoteAction,
    AddRecipientAction,
    AuthorizeCallAction,
    AuthorizeMessageAction,
    CallAction,
    ExecuteBatchRequest,
    ExecuteBatchResponse,
    ExecuteTransferRequest,
    ExecuteTransferResponse,
    EXECUTION_SERVICE_NAME,
    ExecutionServiceMethod,
    IAction,
} from "./client";
import { NetworkService } from "../network";
import { AccountService } from "../account";
import { ProfileService } from "../profile";
import { TokenService } from "../token";
import { TransactionService } from "../transaction";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "../token/functions";
import { getAuthRegistryAddress, getSetAuthorizedFn, getSetAuthorizedSelector } from "@/wallet/utils/auth-registry";
import { Fn } from "@/wallet/utils/fn";
import { AzguardFunctionCall } from "../account/contracts";
import {
    OriginType,
    TransferToken,
    TransferType,
    TxCall,
    TxOrigin,
    TxTransfer,
} from "../transaction/client";

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
                        _request.amount,
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

    public async executeBatch(
        networkId: string,
        accountAddress: string,
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
        const artifacts = await this.prepareArtifacts(pxe, actions);
        
        const args = [];
        const calls = [];
        const txCalls = [];
        for (const action of actions) {
            switch (action.type) {
                case ActionType.AddCapsule: {
                    const _action = (action as AddCapsuleAction)!;
                    await pxe.addCapsule(_action.capsule.map(Fr.fromString));
                    break;
                }
                case ActionType.AddNote: {
                    const _action = (action as AddNoteAction)!;
                    const note = new ExtendedNote(
                        Note.fromString(_action.note),
                        AztecAddress.fromString(_action.owner),
                        AztecAddress.fromString(_action.contract),
                        Fr.fromString(_action.storageSlot),
                        NoteSelector.fromString(_action.storageSlot),
                        TxHash.fromString(_action.txHash),
                    );
                    await pxe.addNote(note, account.address);
                    break;
                }
                case ActionType.AddContact: {
                    const _action = (action as AddRecipientAction)!;
                    await pxe.registerContact(AztecAddress.fromString(_action.address));
                    break;
                }
                case ActionType.AuthorizeCall: {
                    const _action = (action as AuthorizeCallAction)!;
                    if (_action.inPublic) {

                    }
                    else {

                    }
                    break;
                }
                case ActionType.AuthorizeMessage: {
                    const _action = (action as AuthorizeMessageAction)!;
                    const messageHash = poseidon2Hash([Buffer.from(_action.message, 'hex')]);
                    if (_action.inPublic) {
                        const fn = getSetAuthorizedFn();
                        const packedArgs = PackedValues.fromValues(encodeArguments(fn, [messageHash, true]));
                        calls.push(new AzguardFunctionCall(
                            getAuthRegistryAddress(),
                            getSetAuthorizedSelector(),
                            packedArgs.hash,
                            fn.functionType === FunctionType.PUBLIC,
                            fn.isStatic,
                        ));
                    }
                    else {
                        const authwit = await account.buildAuthWitness(messageHash);
                        await pxe.addAuthWitness(authwit);
                    }
                    break;
                }
                case ActionType.Call: {
                    const _action = (action as CallAction)!;
                    const artifact = artifacts.get(_action.contract);
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
            new TxOrigin(OriginType.UI),
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
        amount: string,
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
                    args,
                    [
                        new TxTransfer(
                            new TransferToken(token.name, token.symbol, token.decimals),
                            transferType,
                            accountAddress,
                            recipientAddress,
                            amount,
                        )
                    ]
                ),
            ],
            nonce.toString(),
            txHash.toString(),
        );

        return tx.hash;
    }

    private async prepareArtifacts(pxe: PXE, actions: IAction[]): Promise<Map<string, ContractArtifact>> {
        const contracts = new Set(
            actions
                .filter(x => x.type === ActionType.AuthorizeCall || x.type === ActionType.Call)
                .map(x => (x as AuthorizeCallAction)?.contract ?? (x as CallAction).contract)
        );
        const artifacts = await Promise.all(
            contracts.values().map(x => this.getArtifact(pxe, x))
        );
        return new Map(artifacts)
    }

    private async getArtifact(pxe: PXE, contract: string): Promise<[string, ContractArtifact]> {
        const instance = await pxe.getContractInstance(AztecAddress.fromString(contract));
        if (!instance) {
            throw new Error("Contract not found");
        }
        const artifact = await pxe.getContractArtifact(instance.contractClassId);
        if (!artifact) {
            throw new Error("Contract not found");
        }
        return [contract, artifact];
    }
}