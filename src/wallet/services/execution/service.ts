import {
    computeInnerAuthWitHash,
    computeAuthWitMessageHash,
    type IntentInnerHash,
    type IntentAction,
} from "@aztec/aztec.js";
import type { ExecutionPayload } from "@aztec/entrypoints/payload";
import { Fr } from "@aztec/foundation/fields";
import {
    type AbiDecoded,
    type AbiType,
    AbiTypeSchema,
    type ContractArtifact,
    ContractArtifactSchema,
    encodeArguments,
    FunctionSelector,
    FunctionType,
    FunctionCall,
    decodeFromAbi,
} from "@aztec/stdlib/abi";
import { AuthWitness } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    type CompleteAddress,
    computeContractAddressFromInstance,
    type ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    type NodeInfo,
} from "@aztec/stdlib/contract";
import type { PXE, PXEInfo, ContractClassMetadata, ContractMetadata } from "@aztec/stdlib/interfaces/client";
import { Gas, GasSettings, GasFees } from "@aztec/stdlib/gas";
import {
    Capsule,
    HashedValues,
    PrivateExecutionResult,
    TxExecutionRequest,
    TxHash,
    TxProfileResult,
    TxProvingResult,
    TxReceipt,
    TxSimulationResult,
    UtilitySimulationResult,
    Tx,
    SimulationOverrides,
} from "@aztec/stdlib/tx";
import z from "zod";
import { NetworkService, Network } from "@/wallet/services/network/service";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { AccountService } from "@/wallet/services/account/service";
import { AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";
import { ProfileService } from "@/wallet/services/profile/service";
import { AuthRegistryService } from "@/wallet/services/auth-registry/service";
import { TokenService } from "@/wallet/services/token/service";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "@/wallet/services/token/functions";
import { FpcService } from "@/wallet/services/fpc/service";
import { TransactionService, OriginType, TransferType, TxCall, TxOrigin } from "@/wallet/services/transaction/service";
import { getAuthRegistryAddress, getSetAuthorizedFn, getSetAuthorizedSelector } from "@/wallet/utils/auth-registry";
import type { Fn } from "@/wallet/utils/fn";
import { getFeeJuiceClaimPayload } from "@/wallet/utils/fee-juice";
import {
    TaskService,
    WrappedTask,
    ExecuteOperationContent,
    StepContent,
    TransferContent,
} from "@/wallet/services/task/service";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { getErrorMessage } from "@/wallet/utils/errors";
import {
    EXECUTION_SERVICE_NAME,
    Methods,
    type Operation,
    type GetCompleteAddressOperation,
    type RegisterSenderOperation,
    type RegisterTokenOperation,
    type RegisterContractOperation,
    type SendTransactionOperation,
    type SimulateTransactionOperation,
    type SimulateUtilityOperation,
    type SimulateViewsOperation,
    type OperationResult,
    type CallAuthwitContent,
    type EncodedCallAuthwitContent,
    type IntentAuthwitContent,
    type Action,
    type AddPrivateAuthwitAction,
    type AddPublicAuthwitAction,
    type FeeSettings,
    type AztecSimulateTxOperation,
    type AztecSimulateUtilityOperation,
    type AztecProfileTxOperation,
    type AztecSendTxOperation,
    type AztecGetContractClassMetadataOperation,
    type AztecGetContractMetadataOperation,
    type AztecRegisterContractOperation,
    type AztecRegisterContractClassOperation,
    type AztecProveTxOperation,
    type AztecGetNodeInfoOperation,
    type AztecGetPXEInfoOperation,
    type AztecGetCurrentBaseFeesOperation,
    type AztecUpdateContractOperation,
    type AztecRegisterSenderOperation,
    type AztecGetSendersOperation,
    type AztecRemoveSenderOperation,
    type AztecGetTxReceiptOperation,
    type AztecGetPrivateEventsOperation,
    type AztecGetPublicEventsOperation,
    type AztecGetCompleteAddressOperation,
    type AztecGetAddressOperation,
    type AztecGetChainIdOperation,
    type AztecGetVersionOperation,
    type AztecCreateTxExecutionRequestOperation,
    type AztecCreateAuthWitOperation,
} from "./spec";

export * from "./spec";

export class ExecutionService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = EXECUTION_SERVICE_NAME;

    private pxeService: PxeServiceClient = null!;
    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private tokenService: TokenService = null!;
    private fpcService: FpcService = null!;
    private transactionService: TransactionService = null!;
    private authRegistryService: AuthRegistryService = null!;
    private taskService: TaskService = null!;

    public constructor(logger: ILogger) {
        super(EXECUTION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.tokenService = services.get(TokenService.name);
        this.fpcService = services.get(FpcService.name);
        this.transactionService = services.get(TransactionService.name);
        this.authRegistryService = services.get(AuthRegistryService.name);
        this.taskService = services.get(TaskService.name);
    }

    public async executeTransfer(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): Promise<string> {
        await this.ensureInitialized();
        amount = BigInt(amount);
        const origin: TxOrigin = { type: OriginType.UI };
        const transferContent = new TransferContent(tokenId, transferType, recipientAddress, amount);
        const transferTask = this.taskService.startNewTask(transferContent, undefined, origin);

        try {
            const profile = await this.profileService.getActiveProfile();
            if (!profile) {
                throw new Error("Unauthorized");
            }
            const token = await this.tokenService.getTokenRaw(tokenId);

            let fn: Fn;
            let args: any[];
            switch (transferType) {
                case TransferType.Private: {
                    if (!token.transferPrivateFn) {
                        throw new Error("Transfer type not supported");
                    }
                    fn = TransferPrivateFn.new(token.transferPrivateFn.name, token.transferPrivateFn.impl);
                    args = (fn as TransferPrivateFn).buildArgs(accountAddress, recipientAddress, amount);
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
                    args = (fn as TransferPrivateToPublicFn)?.buildArgs(accountAddress, recipientAddress, amount);
                    break;
                }
                case TransferType.Public: {
                    if (!token.transferPublicFn) {
                        throw new Error("Transfer type not supported");
                    }
                    fn = TransferPublicFn.new(token.transferPublicFn.name, token.transferPublicFn.impl);
                    args = (fn as TransferPublicFn)?.buildArgs(accountAddress, recipientAddress, amount);
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
                    args = (fn as TransferPublicToPrivateFn)?.buildArgs(accountAddress, recipientAddress, amount);
                    break;
                }
                default:
                    throw new Error("Invalid transfer type");
            }
            const selector = await fn.getSelector();
            const encodedArgs = fn.encodeArgs(args);

            const op: Operation = {
                kind: "send_transaction",
                networkId,
                accountAddress,
                feeSettings,
                actions: [
                    {
                        kind: "encoded_call",
                        to: token.contract,
                        selector: selector.toString(),
                        args: encodedArgs.map(x => x.toString()),
                        name: fn.name,
                        type: fn.type,
                        isStatic: fn.isStatic,
                        returnTypes: [],
                    },
                ],
            };

            const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op, transferTask);

            const [txRequest, pxe, account, network, nonce, _, txSetup] = await this.processTx(
                _op,
                _isFeePayer,
                transferTask,
            );
            txRequest.txContext.gasSettings = _gasSettings;

            const simulatedTx = await this.simulateTxRequest(
                pxe,
                txRequest, // txRequest
                true, // simulatePublic
                undefined, // skipTxValidation
                undefined, // skipFeeEnforcement
                undefined, // overrides
                [account.address], // scopes
                transferTask,
            );
            const provedTx = await this.proveTxRequest(
                pxe,
                txRequest,
                simulatedTx.privateExecutionResult,
                transferTask,
            );
            const txHash = await this.sendProvedTx(pxe, await provedTx.toTx(), transferTask);

            const tx = await this.transactionService.addTransaction(
                origin,
                network.chainId,
                accountAddress,
                txSetup,
                _isFeePayer,
                [
                    {
                        contract: token.contract,
                        method: fn.name,
                        args: args.map(x => x.toString()),
                        transfers: [
                            {
                                token: { name: token.name, symbol: token.symbol, decimals: token.decimals },
                                type: transferType,
                                from: accountAddress,
                                to: recipientAddress,
                                amount: amount.toString(),
                            },
                        ],
                    },
                ],
                nonce.toString(),
                txHash.toString(),
            );
            transferTask.complete();
            return tx.hash;
        } catch (error) {
            transferTask.fail(error);
            throw error;
        }
    }

    public async executeOperations(
        operations: Operation[],
        origin: TxOrigin,
        parentTask?: WrappedTask,
    ): Promise<OperationResult[]> {
        await this.ensureInitialized();
        const results: OperationResult[] = [];
        for (const operation of operations) {
            if (results.length && results.at(-1)!.status !== "ok") {
                results.push({ status: "skipped" });
                continue;
            }

            const operationTask = parentTask
                ? parentTask.startSubtask(new ExecuteOperationContent(operation.kind))
                : this.taskService.startNewTask(new ExecuteOperationContent(operation.kind), undefined, origin);

            try {
                let result;
                switch (operation.kind) {
                    case "get_complete_address": {
                        result = await this.executeGetCompleteAddress(operation);
                        break;
                    }
                    case "register_contract": {
                        result = await this.executeRegisterContract(operation);
                        break;
                    }
                    case "register_sender": {
                        result = await this.executeRegisterSender(operation);
                        break;
                    }
                    case "register_token": {
                        result = await this.executeRegisterToken(operation, operationTask);
                        break;
                    }
                    case "send_transaction": {
                        result = await this.executeSendTransaction(operation, origin, operationTask);
                        break;
                    }
                    case "simulate_transaction": {
                        result = await this.executeSimulateTransaction(operation);
                        break;
                    }
                    case "simulate_utility": {
                        result = await this.executeSimulateUtility(operation);
                        break;
                    }
                    case "simulate_views": {
                        result = await this.executeSimulateViews(operation);
                        break;
                    }
                    // Aztec.js PXE:
                    case "aztec_simulateTx": {
                        result = await this.executeAztecSimulateTx(operation);
                        break;
                    }
                    case "aztec_simulateUtility": {
                        result = await this.executeAztecSimulateUtility(operation);
                        break;
                    }
                    case "aztec_profileTx": {
                        result = await this.executeAztecProfileTx(operation);
                        break;
                    }
                    case "aztec_sendTx": {
                        result = await this.executeAztecSendTx(operation);
                        break;
                    }
                    case "aztec_getContractClassMetadata": {
                        result = await this.executeAztecGetContractClassMetadata(operation);
                        break;
                    }
                    case "aztec_getContractMetadata": {
                        result = await this.executeAztecGetContractMetadata(operation);
                        break;
                    }
                    case "aztec_registerContract": {
                        result = await this.executeAztecRegisterContract(operation);
                        break;
                    }
                    case "aztec_registerContractClass": {
                        result = await this.executeAztecRegisterContractClass(operation);
                        break;
                    }
                    case "aztec_proveTx": {
                        result = await this.executeAztecProveTx(operation);
                        break;
                    }
                    case "aztec_getNodeInfo": {
                        result = await this.executeAztecGetNodeInfo(operation);
                        break;
                    }
                    case "aztec_getPXEInfo": {
                        result = await this.executeAztecGetPXEInfo(operation);
                        break;
                    }
                    case "aztec_getCurrentBaseFees": {
                        result = await this.executeAztecGetCurrentBaseFees(operation);
                        break;
                    }
                    case "aztec_updateContract": {
                        result = await this.executeAztecUpdateContract(operation);
                        break;
                    }
                    case "aztec_registerSender": {
                        result = await this.executeAztecRegisterSender(operation);
                        break;
                    }
                    case "aztec_getSenders": {
                        result = await this.executeAztecGetSenders(operation);
                        break;
                    }
                    case "aztec_removeSender": {
                        result = await this.executeAztecRemoveSender(operation);
                        break;
                    }
                    case "aztec_getTxReceipt": {
                        result = await this.executeAztecGetTxReceipt(operation);
                        break;
                    }
                    case "aztec_getPrivateEvents": {
                        result = await this.executeAztecGetPrivateEvents(operation);
                        break;
                    }
                    case "aztec_getPublicEvents": {
                        result = await this.executeAztecGetPublicEvents(operation);
                        break;
                    }
                    // Aztec.js AccountInterface:
                    case "aztec_getCompleteAddress": {
                        result = await this.executeAztecGetCompleteAddress(operation);
                        break;
                    }
                    case "aztec_getAddress": {
                        result = await this.executeAztecGetAddress(operation);
                        break;
                    }
                    case "aztec_getChainId": {
                        result = await this.executeAztecGetChainId(operation);
                        break;
                    }
                    case "aztec_getVersion": {
                        result = await this.executeAztecGetVersion(operation);
                        break;
                    }
                    // Aztec.js EntrypointInterface:
                    case "aztec_createTxExecutionRequest": {
                        result = await this.executeAztecCreateTxExecutionRequest(operation);
                        break;
                    }
                    // Aztec.js AuthWitnessProvider:
                    case "aztec_createAuthWit": {
                        result = await this.executeAztecCreateAuthWit(operation);
                        break;
                    }
                    default: {
                        throw new Error("Invalid operation");
                    }
                }
                operationTask.complete();
                results.push({ status: "ok", result });
            } catch (error) {
                operationTask.fail(error);
                results.push({ status: "failed", error: getErrorMessage(error) });
            }
        }
        return results;
    }

    // Azguard base:

    private async executeGetCompleteAddress(op: GetCompleteAddressOperation): Promise<CompleteAddress> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        return await account.getCompleteAddress();
    }

    private async executeRegisterContract(op: RegisterContractOperation): Promise<void> {
        const addressNum = AztecAddress.fromString(op.address).toBigInt();
        if (addressNum >= 0 && addressNum <= 6) {
            // ignore protocol contracts registration,
            // because we cannot validate it due to hardcoded addresses
            return;
        }

        const network = await this.networkService.getNetwork(op.networkId);

        const providedInstance = await ContractInstanceWithAddressSchema.optional().parseAsync(op.instance);
        const instance =
            providedInstance ??
            (await this.pxeService.getContractMetadata(network, AztecAddress.fromString(op.address))).contractInstance;
        if (!instance) {
            throw new Error("Contract instance not found");
        }

        const providedArtifact = await ContractArtifactSchema.optional().parseAsync(op.artifact);
        const artifact =
            providedArtifact ??
            (await this.pxeService.getContractClassMetadata(network, instance.currentContractClassId)).artifact;
        if (!artifact) {
            throw new Error("Contract artifact not found");
        }

        const contractClass = await getContractClassFromArtifact(artifact);
        if (contractClass.id.toString() !== instance.currentContractClassId.toString()) {
            throw new Error("Contract artifact doesn't match instance's current class id");
        }

        const contractAddress = await computeContractAddressFromInstance(instance);
        if (contractAddress.toString() !== op.address) {
            throw new Error("Contract address doesn't match instance address");
        }

        await this.pxeService.registerContract(network, instance, artifact);
    }

    private async executeRegisterSender(op: RegisterSenderOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        await this.pxeService.registerSender(network, AztecAddress.fromString(op.address));
    }

    private async executeRegisterToken(op: RegisterTokenOperation, parentTask?: WrappedTask): Promise<void> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const ti = await this.tokenService.parseTokenInterface(op.networkId, op.address, parentTask);
        if (
            ti.getNameFn === undefined ||
            ti.getSymbolFn === undefined ||
            ti.getDecimalsFn === undefined ||
            (ti.balanceOfPrivateFn === undefined && ti.balanceOfPublicFn === undefined)
        ) {
            throw new Error("Couldn't find necessary methods in the contract interface. Try to add token manually.");
        }
        await this.tokenService.addToken(profile.id, op.networkId, op.accountAddress, ti, parentTask);
    }

    public async executeSendTransaction(
        op: SendTransactionOperation,
        origin: TxOrigin,
        parentTask?: WrappedTask,
    ): Promise<string> {
        await this.ensureInitialized();
        const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op, parentTask);

        const [txRequest, pxe, account, network, nonce, txCalls, txSetup] = await this.processTx(
            _op,
            _isFeePayer,
            parentTask,
        );
        txRequest.txContext.gasSettings = _gasSettings;

        const simulatedTx = await this.simulateTxRequest(
            pxe,
            txRequest, // txRequest
            true, // simulatePublic
            undefined, // skipTxValidation
            undefined, // skipFeeEnforcement
            undefined, // overrides
            [account.address], // scopes
            parentTask,
        );
        const provedTx = await this.proveTxRequest(pxe, txRequest, simulatedTx.privateExecutionResult, parentTask);
        const txHash = await this.sendProvedTx(pxe, await provedTx.toTx(), parentTask);

        const tx = await this.transactionService.addTransaction(
            origin,
            network.chainId,
            account.address.toString(),
            txSetup,
            _isFeePayer,
            txCalls,
            nonce.toString(),
            txHash.toString(),
        );

        return tx.hash;
    }

    private async executeSimulateTransaction(op: SimulateTransactionOperation): Promise<unknown> {
        const [txRequest, pxe, account] = await this.processTx(op);
        const simulatedTx = await pxe.simulateTx(
            txRequest, // txRequest
            op.simulatePublic ?? false, // simulatePublic
            undefined, // skipTxValidation
            true, // skipFeeEnforcement
            undefined, // overrides
            [account.address], // scopes
        );
        return {
            gasUsed: simulatedTx.gasUsed,
            privateReturn: simulatedTx.getPrivateReturnValues(),
            publicReturn: simulatedTx.getPublicReturnValues(),
        };
    }

    private async executeSimulateUtility(op: SimulateUtilityOperation): Promise<AbiDecoded> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

        const pxe = this.pxeService.getPXE(network);

        const registeredContracts = new Set<string>((await pxe.getContracts()).map(x => x.toString()));
        if (!registeredContracts.has(op.contract)) {
            const [_, instance] = await this.getInstance(pxe, op.contract);
            const [__, artifact] = await this.getArtifact(pxe, instance.currentContractClassId.toString());
            this.logDebug("Register contract");
            await pxe.registerContract({ instance, artifact });
        }

        await account.ensureRegistered(pxe);
        const { result } = await pxe.simulateUtility(
            op.method, // functionName
            op.args, // args
            AztecAddress.fromString(op.contract), // to
            undefined, // authwits
            undefined, // from
            [account.address], // scopes
        );

        return result;
    }

    public async executeSimulateViews(op: SimulateViewsOperation): Promise<{ encoded: Fr[][]; decoded: AbiDecoded[] }> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

        const pxe = this.pxeService.getPXE(network);
        const contracts = this.getContracts(op.calls);
        const instances = await this.getInstances(pxe, contracts);
        const artifacts = await this.getArtifacts(pxe, instances);

        const registeredContracts = new Set<string>((await pxe.getContracts()).map(x => x.toString()));
        for (const [contract, instance] of instances) {
            if (!registeredContracts.has(contract)) {
                this.logDebug("Register contract");
                await pxe.registerContract({
                    instance,
                    artifact: artifacts.get(instance.currentContractClassId.toString()),
                });
            }
        }

        const result: {
            encoded: Fr[][];
            decoded: AbiDecoded[];
        } = {
            encoded: [],
            decoded: [],
        };

        const args: HashedValues[] = [];
        const calls: [AzguardFunctionCall, number, number, AbiType[]][] = [];
        const utility: [Promise<UtilitySimulationResult>, number, AbiType[]][] = [];
        let privateCalls = 0;
        let publicCalls = 0;

        await account.ensureRegistered(pxe);

        for (let i = 0; i < op.calls.length; i++) {
            const call = op.calls[i];
            switch (call.kind) {
                case "call": {
                    const instance = instances.get(call.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.currentContractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract artifact not found");
                    }
                    const fn =
                        artifact.functions.find(x => x.name === call.method) ??
                        artifact.nonDispatchPublicFunctions.find(x => x.name === call.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    if (fn.functionType === FunctionType.UTILITY) {
                        utility.push([
                            pxe.simulateUtility(
                                call.method,
                                call.args,
                                AztecAddress.fromString(call.contract),
                                undefined, // authwits
                                account.address,
                                [account.address],
                            ),
                            i,
                            fn.returnTypes,
                        ]);
                    } else {
                        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                        const packedArgs =
                            fn.functionType === FunctionType.PUBLIC
                                ? await HashedValues.fromCalldata([
                                      fnSelector.toField(),
                                      ...encodeArguments(fn, call.args),
                                  ])
                                : await HashedValues.fromArgs(encodeArguments(fn, call.args));
                        args.push(packedArgs);
                        calls.push([
                            new AzguardFunctionCall(
                                AztecAddress.fromString(call.contract),
                                fnSelector,
                                packedArgs.hash,
                                fn.functionType === FunctionType.PUBLIC,
                                fn.isStatic,
                            ),
                            i,
                            fn.functionType === FunctionType.PUBLIC ? publicCalls++ : privateCalls++,
                            fn.returnTypes,
                        ]);
                    }
                    this.logDebug("Call enqueued.");
                    break;
                }
                case "encoded_call": {
                    const instance = instances.get(call.to);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.currentContractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract artifact not found");
                    }
                    let fn;
                    for (const _fn of artifact.functions) {
                        const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                        if (selector.toString() === call.selector) {
                            fn = _fn;
                            break;
                        }
                    }
                    if (!fn) {
                        for (const _fn of artifact.nonDispatchPublicFunctions) {
                            const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                            if (selector.toString() === call.selector) {
                                fn = _fn;
                                break;
                            }
                        }
                    }
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    if (fn.functionType === FunctionType.UTILITY) {
                        let decodedArgs;
                        try {
                            decodedArgs = decodeFromAbi(
                                fn.parameters.map(x => x.type),
                                call.args.map(x => Fr.fromString(x)),
                            );
                        } catch (error) {
                            const errorMessage = getErrorMessage(error);
                            this.logError("Failed to decode utility call args", fn.parameters, call.args, errorMessage);
                            throw new Error(
                                `Failed to decode utility "encoded_call" args: ${errorMessage}. Try to use "call" instead.`,
                            );
                        }
                        utility.push([
                            pxe.simulateUtility(
                                fn.name,
                                fn.parameters.length === 1
                                    ? [decodedArgs] // CHECK: remove wrapping into array if aztec fix decoder
                                    : (decodedArgs as AbiDecoded[]),
                                AztecAddress.fromString(call.to),
                                undefined, // authwits
                                account.address,
                                [account.address],
                            ),
                            i,
                            fn.returnTypes,
                        ]);
                    } else {
                        const packedArgs =
                            fn.functionType === FunctionType.PUBLIC
                                ? await HashedValues.fromCalldata([
                                      FunctionSelector.fromString(call.selector).toField(),
                                      ...call.args.map(x => Fr.fromString(x)),
                                  ])
                                : await HashedValues.fromArgs(call.args.map(x => Fr.fromString(x)));
                        args.push(packedArgs);
                        calls.push([
                            new AzguardFunctionCall(
                                AztecAddress.fromString(call.to),
                                FunctionSelector.fromString(call.selector),
                                packedArgs.hash,
                                fn.functionType === FunctionType.PUBLIC,
                                fn.isStatic,
                            ),
                            i,
                            fn.functionType === FunctionType.PUBLIC ? publicCalls++ : privateCalls++,
                            fn.returnTypes,
                        ]);
                    }
                    this.logDebug("EncodedCall enqueued.");
                    break;
                }
            }
        }

        if (calls.length) {
            const txRequest = await account.buildTxExecutionRequest(
                pxe,
                [],
                false,
                calls.map(x => x[0]),
                args,
                Fr.zero(),
            );
            const simulatedTx = await pxe.simulateTx(
                txRequest, // txRequest
                true, // simulatePublic
                undefined, // skipTxValidation
                true, // skipFeeEnforcement
                undefined, // overrides
                [account.address], // scopes
            );

            const publicReturn = simulatedTx.getPublicReturnValues();
            const privateReturn =
                txRequest.origin.toString() === op.accountAddress
                    ? simulatedTx.getPrivateReturnValues().nested
                    : simulatedTx.getPrivateReturnValues().nested[1].nested;

            for (const [call, i, j, types] of calls) {
                const values = (call.is_public ? publicReturn[j] : privateReturn[j]).values ?? [];
                result.encoded[i] = values;
                try {
                    result.decoded[i] = decodeFromAbi(types, values);
                } catch (error) {
                    this.logError("Failed to decode simulation results", types, values, getErrorMessage(error));
                }
            }
        }

        for (const [promise, i, types] of utility) {
            const { result: values } = await promise;
            try {
                result.encoded[i] = encodeArguments(
                    {
                        parameters: types.map((x, ind) => ({
                            type: x,
                            name: `result${ind}`,
                            visibility: "public",
                        })),
                    } as any,
                    types.length === 1
                        ? [values] // CHECK: remove wrapping into array if aztec fix decoder
                        : (values as AbiDecoded[]),
                );
            } catch (error) {
                this.logError("Failed to encode utility simulation results", types, values, getErrorMessage(error));
            }
            result.decoded[i] = values;
        }

        return result;
    }

    // Aztec.js PXE:

    private async executeAztecSimulateTx(op: AztecSimulateTxOperation): Promise<TxSimulationResult> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.simulateTx(
            network,
            op.txRequest,
            op.simulatePublic,
            op.skipTxValidation,
            op.skipFeeEnforcement,
            op.overrides,
            op.scopes,
        );
    }

    private async executeAztecSimulateUtility(op: AztecSimulateUtilityOperation): Promise<UtilitySimulationResult> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.simulateUtility(
            network,
            op.functionName,
            op.args,
            op.to,
            op.authwits,
            op.from,
            op.scopes,
        );
    }

    private async executeAztecProfileTx(op: AztecProfileTxOperation): Promise<TxProfileResult> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.profileTx(network, op.txRequest, op.profileMode, op.skipProofGeneration, op.msgSender);
    }

    private async executeAztecSendTx(op: AztecSendTxOperation): Promise<TxHash> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.sendTx(network, op.tx);
    }

    private async executeAztecGetContractClassMetadata(
        op: AztecGetContractClassMetadataOperation,
    ): Promise<ContractClassMetadata> {
        const network = await this.networkService.getNetwork(op.networkId);
        const metadata = await this.pxeService.getContractClassMetadata(network, op.id);
        if (op.includeArtifact !== true) {
            delete metadata.artifact;
        }
        return metadata;
    }

    private async executeAztecGetContractMetadata(op: AztecGetContractMetadataOperation): Promise<ContractMetadata> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getContractMetadata(network, op.address);
    }

    private async executeAztecRegisterContract(op: AztecRegisterContractOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.registerContract(network, op.contract.instance, op.contract.artifact);
    }

    private async executeAztecRegisterContractClass(op: AztecRegisterContractClassOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.registerContractClass(network, op.artifact);
    }

    private async executeAztecProveTx(op: AztecProveTxOperation): Promise<TxProvingResult> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.proveTx(network, op.txRequest, op.privateExecutionResult);
    }

    private async executeAztecGetNodeInfo(op: AztecGetNodeInfoOperation): Promise<NodeInfo> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getNodeInfo(network);
    }

    private async executeAztecGetPXEInfo(op: AztecGetPXEInfoOperation): Promise<PXEInfo> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getPXEInfo(network);
    }

    private async executeAztecGetCurrentBaseFees(op: AztecGetCurrentBaseFeesOperation): Promise<GasFees> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getCurrentBaseFees(network);
    }

    private async executeAztecUpdateContract(op: AztecUpdateContractOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.updateContract(network, op.contractAddress, op.artifact);
    }

    private async executeAztecRegisterSender(op: AztecRegisterSenderOperation): Promise<AztecAddress> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.registerSender(network, op.address);
    }

    private async executeAztecGetSenders(op: AztecGetSendersOperation): Promise<AztecAddress[]> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getSenders(network);
    }

    private async executeAztecRemoveSender(op: AztecRemoveSenderOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.removeSender(network, op.address);
    }

    private async executeAztecGetTxReceipt(op: AztecGetTxReceiptOperation): Promise<TxReceipt> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getTxReceipt(network, op.txHash);
    }

    private async executeAztecGetPrivateEvents(op: AztecGetPrivateEventsOperation): Promise<unknown[]> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getPrivateEvents(
            network,
            op.contractAddress,
            op.eventMetadata,
            op.from,
            op.numBlocks,
            op.recipients,
        );
    }

    private async executeAztecGetPublicEvents(op: AztecGetPublicEventsOperation): Promise<unknown[]> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getPublicEvents(network, op.eventMetadata, op.from, op.limit);
    }

    // Aztec.js AccountInterface:

    public async executeAztecGetCompleteAddress(op: AztecGetCompleteAddressOperation): Promise<CompleteAddress> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        return await account.getCompleteAddress();
    }

    public async executeAztecGetAddress(op: AztecGetAddressOperation): Promise<AztecAddress> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        return account.address;
    }

    public async executeAztecGetChainId(op: AztecGetChainIdOperation): Promise<Fr> {
        const network = await this.networkService.getNetwork(op.networkId);
        const nodeInfo = await this.pxeService.getNodeInfo(network);
        return new Fr(nodeInfo.l1ChainId);
    }

    public async executeAztecGetVersion(op: AztecGetVersionOperation): Promise<Fr> {
        const network = await this.networkService.getNetwork(op.networkId);
        const nodeInfo = await this.pxeService.getNodeInfo(network);
        return new Fr(nodeInfo.rollupVersion);
    }

    // Aztec.js EntrypointInterface:

    public async executeAztecCreateTxExecutionRequest(
        op: AztecCreateTxExecutionRequestOperation,
    ): Promise<TxExecutionRequest> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        const pxe = this.pxeService.getPXE(network);

        const processExecutionPayload = async (
            payload: ExecutionPayload,
            authwits: AuthWitness[],
            capsules: Capsule[],
            args: HashedValues[],
            calls: AzguardFunctionCall[],
        ) => {
            authwits.push(...(await z.array(AuthWitness.schema).parseAsync(payload.authWitnesses)));
            capsules.push(...(await z.array(Capsule.schema).parseAsync(payload.capsules)));
            args.push(...(await z.array(HashedValues.schema).parseAsync(payload.extraHashedArgs)));
            for (const call of payload.calls) {
                const _selector = await FunctionSelector.schema.parseAsync(call.selector);
                const _args = await z.array(Fr.schema).parseAsync(call.args);
                const _packedArgs =
                    call.type === FunctionType.PUBLIC
                        ? await HashedValues.fromCalldata([_selector.toField(), ..._args])
                        : await HashedValues.fromArgs(_args);
                args.push(_packedArgs);
                calls.push(
                    new AzguardFunctionCall(
                        await AztecAddress.schema.parseAsync(call.to),
                        _selector,
                        _packedArgs.hash,
                        call.type === FunctionType.PUBLIC,
                        call.isStatic,
                    ),
                );
            }
        };

        const authwits: AuthWitness[] = [];
        const capsules: Capsule[] = [];
        const args: HashedValues[] = [];
        const setupCalls: AzguardFunctionCall[] = [];
        const appCalls: AzguardFunctionCall[] = [];
        const feePayer = await AztecAddress.schema.parseAsync(op.fee.paymentMethod.feePayer);
        const isFeePayer = feePayer.equals(account.address);
        const gasSettings = await GasSettings.schema.parseAsync(op.fee.gasSettings);
        const nonce = (await Fr.schema.optional().parseAsync(op.options.txNonce)) ?? Fr.random();

        await processExecutionPayload(op.fee.paymentMethod.executionPayload, authwits, capsules, args, setupCalls);
        await processExecutionPayload(op.exec, authwits, capsules, args, appCalls);

        const res = await account.buildTxExecutionRequest(
            pxe,
            setupCalls,
            isFeePayer,
            appCalls,
            args,
            nonce,
            authwits,
            capsules,
        );
        res.txContext.gasSettings = gasSettings;

        return res;
    }

    // Aztec.js AuthWitnessProvider:

    public async executeAztecCreateAuthWit(op: AztecCreateAuthWitOperation): Promise<AuthWitness> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

        const nodeInfo = await this.pxeService.getNodeInfo(network);
        const metadata = {
            chainId: new Fr(nodeInfo.l1ChainId),
            version: new Fr(nodeInfo.rollupVersion),
        };

        let messageHash: Fr;
        if (typeof op.messageHashOrIntent === "object" && "caller" in op.messageHashOrIntent) {
            const { caller, action } = op.messageHashOrIntent;
            const intentAction: IntentAction = {
                caller: await AztecAddress.schema.parseAsync(caller),
                action: {
                    name: action.name,
                    to: await AztecAddress.schema.parseAsync(action.to),
                    selector: await FunctionSelector.schema.parseAsync(action.selector),
                    type: action.type,
                    isStatic: action.isStatic,
                    args: await z.array(Fr.schema).parseAsync(action.args),
                    returnTypes: await z.array(AbiTypeSchema).parseAsync(action.returnTypes),
                } satisfies FunctionCall,
            };
            messageHash = await computeAuthWitMessageHash(intentAction, metadata);
        } else if (typeof op.messageHashOrIntent === "object" && "consumer" in op.messageHashOrIntent) {
            const { consumer, innerHash } = op.messageHashOrIntent;
            const intentHash: IntentInnerHash = {
                consumer: await AztecAddress.schema.parseAsync(consumer),
                innerHash: await Fr.schema.parseAsync(innerHash),
            };
            messageHash = await computeAuthWitMessageHash(intentHash, metadata);
        } else {
            messageHash = await Fr.schema.parseAsync(op.messageHashOrIntent);
        }

        return await account.buildAuthWitness(messageHash);
    }

    // internals

    private async withFeePayment(
        op: SendTransactionOperation,
        parentTask?: WrappedTask,
    ): Promise<[SendTransactionOperation, GasSettings, boolean]> {
        const feeSetupStep = new StepContent("Estimating fee");
        const feeSetupTask = parentTask
            ? parentTask.startSubtask(feeSetupStep)
            : this.taskService.startNewTask(feeSetupStep);
        try {
            const gasPadding = op.feeSettings.gasPadding ?? 1.05;
            switch (op.feeSettings.paymentMethod.kind) {
                case "fj": {
                    if (op.setup?.length) {
                        throw new Error("Custom setup payload is not allowed with this fee payment method");
                    }
                    let [txRequest, pxe, account] = await this.processTx(op, false, feeSetupTask);
                    const simulatedTx = await this.simulateTxRequest(
                        pxe,
                        txRequest, // txRequest
                        true, // simulatePublic
                        undefined, // skipTxValidation
                        true, // skipFeeEnforcement
                        undefined, // overrides
                        [account.address], // scopes
                        feeSetupTask,
                    );
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(gasPadding),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, true];
                }
                case "fjwc": {
                    if (op.setup?.length) {
                        throw new Error("Custom setup payload is not allowed with this fee payment method");
                    }
                    const { claimAmount, claimSecret, messageLeafIndex } = op.feeSettings.paymentMethod;
                    op.setup = getFeeJuiceClaimPayload(op.accountAddress, claimAmount, claimSecret, messageLeafIndex);
                    let [txRequest, pxe, account] = await this.processTx(op, false, feeSetupTask);
                    const simulatedTx = await this.simulateTxRequest(
                        pxe,
                        txRequest, // txRequest
                        true, // simulatePublic
                        undefined, // skipTxValidation
                        true, // skipFeeEnforcement
                        undefined, // overrides
                        [account.address], // scopes
                        feeSetupTask,
                    );
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(gasPadding),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, true];
                }
                case "fpc": {
                    if (op.setup?.length) {
                        throw new Error("Custom setup payload is not allowed with this fee payment method");
                    }
                    const { fpcId, inPublic } = op.feeSettings.paymentMethod;
                    const fpc = await this.fpcService.getFpcImpl(fpcId);
                    // first approach
                    let [txRequest, pxe, account] = await this.processTx(op, false, feeSetupTask);
                    let simulatedTx = await this.simulateTxRequest(
                        pxe,
                        txRequest, // txRequest
                        true, // simulatePublic
                        undefined, // skipTxValidation
                        true, // skipFeeEnforcement
                        undefined, // overrides
                        [account.address], // scopes
                        feeSetupTask,
                    );
                    const baseFees = txRequest.txContext.gasSettings.maxFeesPerGas;
                    let maxFee = simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)).computeFee(baseFees);
                    op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                    // precise estimation
                    [txRequest] = await this.processTx(op, false, feeSetupTask);
                    txRequest.txContext.gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)),
                        simulatedTx.gasUsed.teardownGas.add(fpc.getTeardownGas(inPublic)),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    simulatedTx = await this.simulateTxRequest(
                        pxe,
                        txRequest, // txRequest
                        true, // simulatePublic
                        undefined, // skipTxValidation
                        true, // skipFeeEnforcement
                        undefined, // overrides
                        [account.address], // scopes
                        feeSetupTask,
                    );
                    maxFee = simulatedTx.gasUsed.totalGas.mul(gasPadding).computeFee(baseFees);
                    op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(gasPadding),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, false];
                }
                case "custom": {
                    if (!op.setup?.length) {
                        throw new Error("Setup payload is missed");
                    }
                    const { teardownDaGas, teardownL2Gas } = op.feeSettings.paymentMethod;
                    let [txRequest, pxe, account] = await this.processTx(op, false, feeSetupTask);
                    txRequest.txContext.gasSettings = new GasSettings(
                        txRequest.txContext.gasSettings.gasLimits,
                        new Gas(teardownDaGas ?? 30_000, teardownL2Gas ?? 150_000),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    const simulatedTx = await this.simulateTxRequest(
                        pxe,
                        txRequest, // txRequest
                        true, // simulatePublic
                        undefined, // skipTxValidation
                        true, // skipFeeEnforcement
                        undefined, // overrides
                        [account.address], // scopes
                        feeSetupTask,
                    );
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(gasPadding),
                        txRequest.txContext.gasSettings.maxFeesPerGas.mul(3), // TODO: remove multiplier when base fees are fixed
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    const isFeePayer =
                        simulatedTx.publicInputs.feePayer.isZero() ||
                        simulatedTx.publicInputs.feePayer.equals(account.address) ||
                        // see [previous_kernel_public_inputs.fee_payer] at Prover.toml
                        simulatedTx.publicInputs.feePayer.equals(
                            AztecAddress.fromString(
                                "0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000",
                            ),
                        );
                    feeSetupTask.complete();
                    return [op, gasSettings, isFeePayer];
                }
                default: {
                    throw new Error("Invalid fee payment method");
                }
            }
        } catch (error) {
            feeSetupTask.fail(error);
            throw error;
        }
    }

    private async processTx(
        op: {
            networkId: string;
            accountAddress: string;
            actions: Action[];
            setup?: Action[];
        },
        isFeePayer = false,
        parentTask?: WrappedTask,
    ): Promise<[TxExecutionRequest, PXE, IAccountContract, Network, Fr, TxCall[], TxCall[]]> {
        let network: Network;
        let account: IAccountContract;
        let pxe: PXE;
        let nonce: Fr;
        let txCalls: TxCall[];
        let txSetup: TxCall[];
        let txRequest: TxExecutionRequest;

        const processingStep = new StepContent("Processing transaction");
        const processingTask = parentTask
            ? parentTask.startSubtask(processingStep)
            : this.taskService.startNewTask(processingStep);

        try {
            const profile = await this.profileService.getActiveProfile();
            if (!profile) {
                throw new Error("Wallet locked");
            }
            network = await this.networkService.getNetwork(op.networkId);
            account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

            pxe = this.pxeService.getPXE(network);
            const nodeInfo = await pxe.getNodeInfo();
            const contracts = this.getContracts(op.actions.concat(op.setup ?? []));
            const instances = await this.getInstances(pxe, contracts);
            const artifacts = await this.getArtifacts(pxe, instances);

            const registeredContracts = new Set<string>((await pxe.getContracts()).map(x => x.toString()));
            for (const [contract, instance] of instances) {
                if (!registeredContracts.has(contract)) {
                    this.logDebug("Register contract");
                    await pxe.registerContract({
                        instance,
                        artifact: artifacts.get(instance.currentContractClassId.toString()),
                    });
                }
            }

            const capsules: Capsule[] = [];
            const authwits: AuthWitness[] = [];
            const args: HashedValues[] = [];
            const calls: AzguardFunctionCall[] = [];
            const setup: AzguardFunctionCall[] = [];
            txCalls = [];
            txSetup = [];

            if (op.setup?.length) {
                await this.processTxActions(
                    op.setup,
                    capsules,
                    authwits,
                    account,
                    nodeInfo,
                    instances,
                    artifacts,
                    args,
                    setup,
                    txSetup,
                );
            }

            if (op.actions?.length) {
                await this.processTxActions(
                    op.actions,
                    capsules,
                    authwits,
                    account,
                    nodeInfo,
                    instances,
                    artifacts,
                    args,
                    calls,
                    txCalls,
                );
            }

            nonce = Fr.random();
            txRequest = await account.buildTxExecutionRequest(
                pxe,
                setup,
                isFeePayer,
                calls,
                args,
                nonce,
                authwits,
                capsules,
            );
            processingTask.complete();
        } catch (error) {
            processingTask.fail(error);
            throw error;
        }

        return [txRequest, pxe, account, network, nonce, txCalls, txSetup];
    }

    private async processTxActions(
        actions: Action[],
        capsules: Capsule[],
        authwits: AuthWitness[],
        account: IAccountContract,
        nodeInfo: NodeInfo,
        instances: Map<string, ContractInstanceWithAddress>,
        artifacts: Map<string, ContractArtifact>,
        args: HashedValues[],
        calls: AzguardFunctionCall[],
        txCalls: TxCall[],
    ) {
        for (const action of actions) {
            switch (action.kind) {
                case "add_capsule": {
                    this.logDebug("Adding capsule...");
                    capsules.push(
                        new Capsule(
                            AztecAddress.fromString(action.contract),
                            Fr.fromString(action.storageSlot),
                            action.capsule.map(Fr.fromString),
                        ),
                    );
                    this.logDebug("Capsule added.");
                    break;
                }
                case "add_private_authwit": {
                    this.logDebug("Adding private authwit...");

                    let messageHash: Fr;
                    switch (action.content.kind) {
                        case "call": {
                            messageHash = await this.getCallMessageHash(action.content, nodeInfo, instances, artifacts);
                            break;
                        }
                        case "encoded_call": {
                            messageHash = await this.getEncodedCallMessageHash(
                                action.content,
                                nodeInfo,
                                instances,
                                artifacts,
                            );
                            break;
                        }
                        case "intent": {
                            messageHash = await this.getIntentMessageHash(action.content, nodeInfo);
                            break;
                        }
                        case "message_hash": {
                            messageHash = Fr.fromString(action.content.messageHash);
                            break;
                        }
                        default: {
                            throw new Error("Invalid authwit content kind");
                        }
                    }

                    const authwit = action.authwit
                        ? new AuthWitness(
                              messageHash,
                              action.authwit.map(x => Fr.fromString(x)),
                          )
                        : await account.buildAuthWitness(messageHash);

                    authwits.push(authwit);

                    this.logDebug("Private authwit added.");
                    break;
                }
                case "add_public_authwit": {
                    this.logDebug("Adding public authwit...");

                    let messageHash: Fr;
                    switch (action.content.kind) {
                        case "call": {
                            messageHash = await this.getCallMessageHash(action.content, nodeInfo, instances, artifacts);
                            await this.authRegistryService.trackAuthwit(
                                account.address.toString(),
                                messageHash.toString(),
                                action.content,
                            );
                            break;
                        }
                        case "encoded_call": {
                            messageHash = await this.getEncodedCallMessageHash(
                                action.content,
                                nodeInfo,
                                instances,
                                artifacts,
                            );
                            await this.authRegistryService.trackAuthwit(
                                account.address.toString(),
                                messageHash.toString(),
                                action.content,
                            );
                            break;
                        }
                        case "intent": {
                            messageHash = await this.getIntentMessageHash(action.content, nodeInfo);
                            await this.authRegistryService.trackAuthwit(
                                account.address.toString(),
                                messageHash.toString(),
                                action.content,
                            );
                            break;
                        }
                        case "message_hash": {
                            messageHash = Fr.fromString(action.content.messageHash);
                            await this.authRegistryService.trackAuthwit(
                                account.address.toString(),
                                messageHash.toString(),
                                action.content,
                            );
                            break;
                        }
                        default: {
                            throw new Error("Invalid authwit content kind");
                        }
                    }

                    const fn = getSetAuthorizedFn();
                    const packedArgs =
                        fn.functionType === FunctionType.PUBLIC
                            ? await HashedValues.fromCalldata([
                                  (await getSetAuthorizedSelector()).toField(),
                                  ...encodeArguments(fn, [messageHash, true]),
                              ])
                            : await HashedValues.fromArgs(encodeArguments(fn, [messageHash, true]));
                    args.push(packedArgs);
                    calls.push(
                        new AzguardFunctionCall(
                            getAuthRegistryAddress(),
                            await getSetAuthorizedSelector(),
                            packedArgs.hash,
                            fn.functionType === FunctionType.PUBLIC,
                            fn.isStatic,
                        ),
                    );
                    txCalls.push({
                        contract: getAuthRegistryAddress().toString(),
                        method: fn.name,
                        args: [messageHash, true],
                    });

                    this.logDebug("Public authwit added.");
                    break;
                }
                case "call": {
                    const instance = instances.get(action.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.currentContractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract artifact not found");
                    }
                    const fn =
                        artifact.functions.find(x => x.name === action.method) ??
                        artifact.nonDispatchPublicFunctions.find(x => x.name === action.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                    const packedArgs =
                        fn.functionType === FunctionType.PUBLIC
                            ? await HashedValues.fromCalldata([
                                  fnSelector.toField(),
                                  ...encodeArguments(fn, action.args),
                              ])
                            : await HashedValues.fromArgs(encodeArguments(fn, action.args));
                    args.push(packedArgs);
                    calls.push(
                        new AzguardFunctionCall(
                            AztecAddress.fromString(action.contract),
                            fnSelector,
                            packedArgs.hash,
                            fn.functionType === FunctionType.PUBLIC,
                            fn.isStatic,
                        ),
                    );
                    txCalls.push({ contract: action.contract, method: action.method, args: action.args });
                    this.logDebug("Call enqueued.");
                    break;
                }
                case "encoded_call": {
                    if (action.type === undefined || action.isStatic === undefined) {
                        const instance = instances.get(action.to);
                        if (!instance) {
                            throw new Error("Contract not found");
                        }
                        const artifact = artifacts.get(instance.currentContractClassId.toString());
                        if (!artifact) {
                            throw new Error("Contract artifact not found");
                        }
                        let fn;
                        for (const _fn of artifact.functions) {
                            const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                            if (selector.toString() === action.selector) {
                                fn = _fn;
                                break;
                            }
                        }
                        if (!fn) {
                            for (const _fn of artifact.nonDispatchPublicFunctions) {
                                const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                                if (selector.toString() === action.selector) {
                                    fn = _fn;
                                    break;
                                }
                            }
                        }
                        if (!fn) {
                            throw new Error("Method not found");
                        }
                        action.type = fn.functionType;
                        action.isStatic = fn.isStatic;
                    }
                    const packedArgs =
                        action.type === FunctionType.PUBLIC
                            ? await HashedValues.fromCalldata([
                                  FunctionSelector.fromString(action.selector).toField(),
                                  ...action.args.map(x => Fr.fromString(x)),
                              ])
                            : await HashedValues.fromArgs(action.args.map(x => Fr.fromString(x)));
                    args.push(packedArgs);
                    calls.push(
                        new AzguardFunctionCall(
                            AztecAddress.fromString(action.to),
                            FunctionSelector.fromString(action.selector),
                            packedArgs.hash,
                            action.type === FunctionType.PUBLIC,
                            action.isStatic,
                        ),
                    );
                    txCalls.push({ contract: action.to, method: action.selector, args: action.args });
                    this.logDebug("EncodedCall enqueued.");
                    break;
                }
            }
        }
    }

    private async simulateTxRequest(
        pxe: PXE,
        txRequest: TxExecutionRequest,
        simulatePublic: boolean,
        skipTxValidation?: boolean,
        skipFeeEnforcement?: boolean,
        overrides?: SimulationOverrides,
        scopes?: AztecAddress[],
        parentTask?: WrappedTask,
    ) {
        let simulatedTx: TxSimulationResult;
        const simulationStep = new StepContent("Simulating transaction");
        const simulationTask = parentTask
            ? parentTask.startSubtask(simulationStep)
            : this.taskService.startNewTask(simulationStep);
        try {
            simulatedTx = await pxe.simulateTx(
                txRequest,
                simulatePublic,
                skipTxValidation,
                skipFeeEnforcement,
                overrides,
                scopes,
            );
            simulationTask.complete();
        } catch (error) {
            simulationTask.fail(error);
            throw error;
        }
        return simulatedTx;
    }

    private async proveTxRequest(
        pxe: PXE,
        txRequest: TxExecutionRequest,
        privateExecutionResult?: PrivateExecutionResult,
        parentTask?: WrappedTask,
    ) {
        let provedTx: TxProvingResult;
        const provingStep = new StepContent("Generating proof");
        const provingTask = parentTask
            ? parentTask.startSubtask(provingStep)
            : this.taskService.startNewTask(provingStep);
        try {
            provedTx = await pxe.proveTx(txRequest, privateExecutionResult);
            provingTask.complete();
        } catch (error) {
            provingTask.fail(error);
            throw error;
        }
        return provedTx;
    }

    private async sendProvedTx(pxe: PXE, tx: Tx, parentTask?: WrappedTask): Promise<TxHash> {
        let txHash: TxHash;
        const sendingStep = new StepContent("Sending transaction");
        const sendingTask = parentTask
            ? parentTask.startSubtask(sendingStep)
            : this.taskService.startNewTask(sendingStep);
        try {
            txHash = await pxe.sendTx(tx);
            sendingTask.complete();
        } catch (error) {
            sendingTask.fail(error);
            throw error;
        }
        return txHash;
    }

    private async getCallMessageHash(
        content: CallAuthwitContent,
        nodeInfo: NodeInfo,
        instances: Map<string, ContractInstanceWithAddress>,
        artifacts: Map<string, ContractArtifact>,
    ): Promise<Fr> {
        const instance = instances.get(content.contract);
        if (!instance) {
            throw new Error("Contract not found");
        }
        const artifact = artifacts.get(instance.currentContractClassId.toString());
        if (!artifact) {
            throw new Error("Contract artifact not found");
        }
        const fn =
            artifact.functions.find(x => x.name === content.method) ??
            artifact.nonDispatchPublicFunctions.find(x => x.name === content.method);
        if (!fn) {
            throw new Error("Method not found");
        }
        return await computeAuthWitMessageHash(
            {
                caller: AztecAddress.fromString(content.caller),
                action: new FunctionCall(
                    fn.name,
                    AztecAddress.fromString(content.contract),
                    await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters),
                    fn.functionType,
                    fn.isStatic,
                    encodeArguments(fn, content.args),
                    fn.returnTypes,
                ),
            },
            {
                chainId: new Fr(nodeInfo.l1ChainId),
                version: new Fr(nodeInfo.rollupVersion),
            },
        );
    }

    private async getEncodedCallMessageHash(
        content: EncodedCallAuthwitContent,
        nodeInfo: NodeInfo,
        instances: Map<string, ContractInstanceWithAddress>,
        artifacts: Map<string, ContractArtifact>,
    ): Promise<Fr> {
        if (
            content.name === undefined ||
            content.type === undefined ||
            content.isStatic === undefined ||
            content.returnTypes === undefined
        ) {
            const instance = instances.get(content.to);
            if (!instance) {
                throw new Error("Contract not found");
            }
            const artifact = artifacts.get(instance.currentContractClassId.toString());
            if (!artifact) {
                throw new Error("Contract artifact not found");
            }
            let fn;
            for (const _fn of artifact.functions) {
                const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                if (selector.toString() === content.selector) {
                    fn = _fn;
                    break;
                }
            }
            if (!fn) {
                for (const _fn of artifact.nonDispatchPublicFunctions) {
                    const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                    if (selector.toString() === content.selector) {
                        fn = _fn;
                        break;
                    }
                }
            }
            if (!fn) {
                throw new Error("Method not found");
            }
            content.name = fn.name;
            content.type = fn.functionType;
            content.isStatic = fn.isStatic;
            content.returnTypes = fn.returnTypes;
        }
        return await computeAuthWitMessageHash(
            {
                caller: AztecAddress.fromString(content.caller),
                action: new FunctionCall(
                    content.name,
                    AztecAddress.fromString(content.to),
                    FunctionSelector.fromString(content.selector),
                    content.type as FunctionType,
                    content.isStatic,
                    content.args.map(x => Fr.fromString(x)),
                    await z.array(AbiTypeSchema).parseAsync(content.returnTypes),
                ),
            },
            {
                chainId: new Fr(nodeInfo.l1ChainId),
                version: new Fr(nodeInfo.rollupVersion),
            },
        );
    }

    private async getIntentMessageHash(content: IntentAuthwitContent, nodeInfo: NodeInfo): Promise<Fr> {
        return await computeAuthWitMessageHash(
            {
                consumer: AztecAddress.fromString(content.consumer),
                innerHash: await computeInnerAuthWitHash(content.intent.map(x => Fr.fromString(x))),
            },
            {
                chainId: new Fr(nodeInfo.l1ChainId),
                version: new Fr(nodeInfo.rollupVersion),
            },
        );
    }

    private getContracts(actions: Action[]) {
        return [
            ...new Set(
                actions
                    .filter(x => x.kind === "add_private_authwit" && x.content.kind === "call")
                    .map(x => ((x as AddPrivateAuthwitAction).content as CallAuthwitContent).contract)
                    .concat(
                        actions
                            .filter(x => x.kind === "add_private_authwit" && x.content.kind === "encoded_call")
                            .map(x => ((x as AddPrivateAuthwitAction).content as EncodedCallAuthwitContent).to),
                    )
                    .concat(
                        actions
                            .filter(x => x.kind === "add_public_authwit" && x.content.kind === "call")
                            .map(x => ((x as AddPublicAuthwitAction).content as CallAuthwitContent).contract),
                    )
                    .concat(
                        actions
                            .filter(x => x.kind === "add_public_authwit" && x.content.kind === "encoded_call")
                            .map(x => ((x as AddPublicAuthwitAction).content as EncodedCallAuthwitContent).to),
                    )
                    .concat(actions.filter(x => x.kind === "call").map(x => x.contract))
                    .concat(actions.filter(x => x.kind === "encoded_call").map(x => x.to)),
            ),
        ];
    }

    private async getInstances(pxe: PXE, contracts: string[]): Promise<Map<string, ContractInstanceWithAddress>> {
        this.logDebug("Get instances...");
        const instances = new Map<string, ContractInstanceWithAddress>();
        this.logDebug(`Fetching ${contracts.length} instances...`);
        const fetched = await Promise.all(contracts.map(x => this.getInstance(pxe, x)));
        this.logDebug(`${fetched.length} instances fetched`);
        for (const [address, instance] of fetched) {
            instances.set(address, instance);
        }
        return instances;
    }

    private async getInstance(pxe: PXE, contract: string): Promise<[string, ContractInstanceWithAddress]> {
        const metadata = await pxe.getContractMetadata(AztecAddress.fromString(contract));
        if (!metadata.contractInstance) {
            throw new Error("Contract instance not found");
        }
        return [contract, metadata.contractInstance];
    }

    private async getArtifacts(
        pxe: PXE,
        instances: Map<string, ContractInstanceWithAddress>,
    ): Promise<Map<string, ContractArtifact>> {
        this.logDebug("Get artifacts...");
        const artifacts = new Map<string, ContractArtifact>();
        const classIds = new Set(
            instances
                .values()
                .filter(x => !artifacts.has(x.currentContractClassId.toString()))
                .map(x => x.currentContractClassId.toString()),
        );
        this.logDebug(`Fetching ${classIds.size} artifacts...`);
        const fetched = await Promise.all(classIds.values().map(x => this.getArtifact(pxe, x)));
        this.logDebug(`${fetched.length} artifacts fetched`);
        for (const [classId, artifact] of fetched) {
            artifacts.set(classId, artifact);
        }
        return artifacts;
    }

    private async getArtifact(pxe: PXE, classId: string): Promise<[string, ContractArtifact]> {
        const metadata = await pxe.getContractClassMetadata(Fr.fromString(classId));
        if (!metadata.artifact) {
            throw new Error("Contract artifact not found");
        }
        return [classId, metadata.artifact];
    }
}
