import {
    computeInnerAuthWitHash,
    computeAuthWitMessageHash,
} from "@aztec/aztec.js";
import { Fr } from '@aztec/foundation/fields';
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
} from "@aztec/stdlib/abi";
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import {
    type CompleteAddress,
    computeContractAddressFromInstance,
    type ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    type NodeInfo,
} from "@aztec/stdlib/contract";
import type { PXE } from '@aztec/stdlib/interfaces/client';
import { Gas, GasFees, GasSettings } from "@aztec/stdlib/gas";
import { Capsule, HashedValues, PrivateExecutionResult, TxExecutionRequest, TxHash, TxProvingResult, TxSimulationResult, UtilitySimulationResult, Tx, SimulationOverrides } from '@aztec/stdlib/tx';
import z from "zod";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { NetworkService } from "@/wallet/services/network";
import type { Network } from "@/wallet/services/network/client";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import type { AccountService } from "@/wallet/services/account";
import { AzguardFunctionCall, type IAccountContract } from "@/wallet/services/account/contracts";
import type { ProfileService } from "@/wallet/services/profile";
import type { AccountStateService } from "@/wallet/services/account-state";
import type { TokenService } from "@/wallet/services/token";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "@/wallet/services/token/functions";
import type { FpcService } from "@/wallet/services/fpc";
import type { TransactionService } from "@/wallet/services/transaction";
import {
    OriginType,
    TransferToken,
    TransferType,
    TxCall,
    TxOrigin,
    TxTransfer,
} from "@/wallet/services/transaction/client";
import { getAuthRegistryAddress, getSetAuthorizedFn, getSetAuthorizedSelector } from "@/wallet/utils/auth-registry";
import { decodeFromAbiPatched } from "@/wallet/utils/abi-decoder";
import type { Fn } from "@/wallet/utils/fn";
import { getFeeJuiceClaimPayload } from "@/wallet/utils/fee-juice";
import { TaskService } from "@/wallet/services/task";
import { WrappedTask } from "@/wallet/services/task/wrapped-task";
import { ExecuteOperationContent, StepContent, TransferContent } from "@/wallet/services/task/client";
import {
    EXECUTION_SERVICE_NAME,
    ExecutionServiceMethod,
    type ExecuteTransferRequest,
    ExecuteTransferResponse,
    type ExecuteOperationsRequest,
    ExecuteOperationsResponse,
    OperationKind,
    type IOperation,
    type GetCompleteAddressOperation,
    type RegisterSenderOperation,
    type RegisterTokenOperation,
    type RegisterContractOperation,
    SendTransactionOperation,
    type SimulateTransactionOperation,
    type SimulateUtilityOperation,
    type SimulateViewsOperation,
    OperationStatus,
    type IOperationResult,
    SkippedOperationResult,
    FailedOperationResult,
    OkOperationResult,
    AuthwitContentKind,
    type CallAuthwitContent,
    type EncodedCallAuthwitContent,
    type IntentAuthwitContent,
    type MessageHashAuthwitContent,
    ActionKind,
    type IAction,
    type AddCapsuleAction,
    type AddPrivateAuthwitAction,
    type AddPublicAuthwitAction,
    type CallAction,
    EncodedCallAction,
    FeePaymentMethodType,
    type FpcPaymentMethod,
    type FeeJuiceWithClaimPaymentMethod,
    type CustomPaymentMethod,
    type FeeSettings,
} from "./client";

export class ExecutionService extends Service {
    private readonly pxeService: PxeServiceClient;

    constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        private readonly accountService: AccountService,
        private readonly tokenService: TokenService,
        private readonly fpcService: FpcService,
        private readonly transactionService: TransactionService,
        private readonly accountStateService: AccountStateService,
        private readonly taskService: TaskService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void,
    ) {
        super(EXECUTION_SERVICE_NAME, logger, emit);
        this.pxeService = new PxeServiceClient();
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
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
                        _request.feeSettings,
                    );
                    return new ExecuteTransferResponse(_request, txHash);
                }
                catch (error: any) {
                    return new ExecuteTransferResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case ExecutionServiceMethod.ExecuteOperations: {
                const _request = request as ExecuteOperationsRequest;
                try {
                    const results = await this.executeOperations(_request.operations, _request.origin);
                    return new ExecuteOperationsResponse(_request, results);
                }
                catch (error: any) {
                    return new ExecuteOperationsResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`)
                return undefined;
            }                
        }
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
        const origin = new TxOrigin(OriginType.UI);
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
            const selector = await fn.getSelector();
            const encodedArgs = fn.encodeArgs(args);
            
            const op = new SendTransactionOperation(
                networkId,
                accountAddress,
                feeSettings,
                [
                    new EncodedCallAction(
                        token.contract,
                        selector.toString(),
                        encodedArgs.map(x => x.toString()),
                        fn.name,
                        fn.type,
                        fn.isStatic,
                        [],
                    ),
                ],
            );

            const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op, transferTask);

            const [txRequest, pxe, account, network, nonce, _, txSetup] = await this.processTx(_op, _isFeePayer, transferTask);
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
            const provedTx = await this.proveTxRequest(pxe, txRequest, simulatedTx.privateExecutionResult, transferTask);
            const txHash = await this.sendProvedTx(pxe, provedTx.toTx(), transferTask);

            const tx = await this.transactionService.addTransaction(
                origin,
                network.chainId,
                accountAddress,
                txSetup,
                _isFeePayer,
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
            transferTask.complete();
            return tx.hash;
        }
        catch (error) {
            const errorMessage = (error as Error)?.message ?? error as string ?? "Transfer failed";
            transferTask.fail(errorMessage);
            throw error;
        }
    }

    public async executeOperations(operations: IOperation[], origin: TxOrigin, parentTask?: WrappedTask): Promise<IOperationResult[]> {
        const results: IOperationResult[] = [];
        for (const operation of operations) {

            if (results.length && results.at(-1)!.status !== OperationStatus.Ok) {
                results.push(new SkippedOperationResult());
                continue;
            }

            const operationTask = parentTask
                ? parentTask.startSubtask(new ExecuteOperationContent(operation.kind))
                : this.taskService.startNewTask(new ExecuteOperationContent(operation.kind), undefined, origin);
            try {
                let result;
                switch (operation.kind) {
                    case OperationKind.GetCompleteAddress: {
                        result = await this.executeGetCompleteAddress(operation as GetCompleteAddressOperation);
                        break;
                    }
                    case OperationKind.RegisterContract: {
                        result = await this.executeRegisterContract(operation as RegisterContractOperation);
                        break;
                    }
                    case OperationKind.RegisterSender: {
                        result = await this.executeRegisterSender(operation as RegisterSenderOperation);
                        break;
                    }
                    case OperationKind.RegisterToken: {
                        result = await this.executeRegisterToken(operation as RegisterTokenOperation, operationTask);
                        break;
                    }
                    case OperationKind.SendTransaction: {
                        result = await this.executeSendTransaction(operation as SendTransactionOperation, origin, operationTask);
                        break;
                    }
                    case OperationKind.SimulateTransaction: {
                        result = await this.executeSimulateTransaction(operation as SimulateTransactionOperation);
                        break;
                    }
                    case OperationKind.SimulateUtility: {
                        result = await this.executeSimulateUtility(operation as SimulateUtilityOperation);
                        break;
                    }
                    case OperationKind.SimulateViews: {
                        result = await this.executeSimulateViews(operation as SimulateViewsOperation);
                        break;
                    }
                    default: {
                        throw new Error("Invalid operation");
                    }
                }
                operationTask.complete();
                results.push(new OkOperationResult(result));
            }
            catch (error) {
                const errorMessage = (error as Error)?.message ?? error as string ?? "Unknown error";
                operationTask.fail(errorMessage);
                results.push(new FailedOperationResult(errorMessage));
            }
        }
        return results;
    }

    async executeGetCompleteAddress(op: GetCompleteAddressOperation): Promise<CompleteAddress> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        return await account.getCompleteAddress();
    }

    async executeRegisterContract(op: RegisterContractOperation): Promise<void> {
        const addressNum = AztecAddress.fromString(op.address).toBigInt();
        if (addressNum >= 0 && addressNum <= 6) {
            // ignore protocol contracts registration,
            // because we cannot validate it due to hardcoded addresses
            return;
        }

        const network = await this.networkService.getNetwork(op.networkId);

        const providedInstance = await ContractInstanceWithAddressSchema.optional().parseAsync(op.instance);
        const instance = providedInstance ??
            (await this.pxeService.getContractMetadata(network, AztecAddress.fromString(op.address))).contractInstance;
        if (!instance) {
            throw new Error("Contract instance not found");
        }

        const providedArtifact = await ContractArtifactSchema.optional().parseAsync(op.artifact);
        const artifact = providedArtifact
            ?? (await this.pxeService.getContractClassMetadata(network, instance.currentContractClassId)).artifact;
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

        await this.pxeService.registerContract(network, {instance, artifact});
    }

    async executeRegisterSender(op: RegisterSenderOperation): Promise<void> {
        const network = await this.networkService.getNetwork(op.networkId);
        await this.pxeService.registerSender(network, AztecAddress.fromString(op.address));
    }

    async executeRegisterToken(op: RegisterTokenOperation, parentTask?: WrappedTask): Promise<void> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const ti = await this.tokenService.parseTokenInterface(op.networkId, op.address, parentTask);
        if (ti.getNameFn === undefined ||
            ti.getSymbolFn === undefined ||
            ti.getDecimalsFn === undefined ||
            ti.balanceOfPrivateFn === undefined &&
            ti.balanceOfPublicFn === undefined
        ) {
            throw new Error("Couldn't find necessary methods in the contract interface. Try to add token manually.");
        }
        await this.tokenService.addToken(profile.id, op.networkId, op.accountAddress, ti, parentTask);
    }

    async withFeePayment(op: SendTransactionOperation, parentTask?: WrappedTask): Promise<[SendTransactionOperation, GasSettings, boolean]> {
        const feeSetupStep = new StepContent("Estimating fee");
        const feeSetupTask = parentTask
            ? parentTask.startSubtask(feeSetupStep)
            : this.taskService.startNewTask(feeSetupStep);
        try {
            switch (op.feeSettings.paymentMethod.type) {
                case FeePaymentMethodType.FeeJuice: {
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
                    const baseFees = await pxe.getCurrentBaseFees();
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, true];
                }
                case FeePaymentMethodType.FeeJuiceWithClaim: {
                    if (op.setup?.length) {
                        throw new Error("Custom setup payload is not allowed with this fee payment method");
                    }
                    const method = op.feeSettings.paymentMethod as FeeJuiceWithClaimPaymentMethod;
                    op.setup = getFeeJuiceClaimPayload(
                        op.accountAddress,
                        method.claimAmount,
                        method.claimSecret,
                        method.messageLeafIndex,
                    );
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
                    const baseFees = await pxe.getCurrentBaseFees();
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, true];
                }
                case FeePaymentMethodType.Fpc: {
                    if (op.setup?.length) {
                        throw new Error("Custom setup payload is not allowed with this fee payment method");
                    }
                    const { fpcId, inPublic } = op.feeSettings.paymentMethod as FpcPaymentMethod;
                    const fpc = await this.fpcService.getFpc(fpcId);
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
                    const baseFees = await pxe.getCurrentBaseFees();
                    let maxFee = simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)).computeFee(baseFees);
                    op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                    // precise estimation
                    [txRequest] = await this.processTx(op, false, feeSetupTask);
                    txRequest.txContext.gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)),
                        simulatedTx.gasUsed.teardownGas.add(fpc.getTeardownGas(inPublic)),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
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
                    maxFee = simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding).computeFee(baseFees);
                    op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                    const gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
                    );
                    feeSetupTask.complete();
                    return [op, gasSettings, false];
                }
                case FeePaymentMethodType.Custom: {
                    if (!op.setup?.length) {
                        throw new Error("Setup payload is missed");
                    }
                    const { teardownDaGas, teardownL2Gas } = op.feeSettings.paymentMethod as CustomPaymentMethod;
                    let [txRequest, pxe, account] = await this.processTx(op, false, feeSetupTask);
                    const baseFees = await pxe.getCurrentBaseFees();
                    txRequest.txContext.gasSettings = new GasSettings(
                        txRequest.txContext.gasSettings.gasLimits,
                        new Gas(teardownDaGas, teardownL2Gas),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
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
                        simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                        simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                        baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                        new GasFees(0, 0),
                    );
                    const isFeePayer =
                        simulatedTx.publicInputs.feePayer.isZero() ||
                        simulatedTx.publicInputs.feePayer.equals(account.address) ||
                        // see [previous_kernel_public_inputs.fee_payer] at Prover.toml
                        simulatedTx.publicInputs.feePayer.equals(AztecAddress.fromString("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000000"));
                    feeSetupTask.complete();
                    return [op, gasSettings, isFeePayer];
                }
                default: {
                    throw new Error("Invalid fee payment method");
                }
            }
        } catch (error) {
            const errorMessage = (error as Error)?.message ?? error as string ?? "Fee estimation failed";
            feeSetupTask.fail(errorMessage);
            throw error;
        }
    }

    async executeSendTransaction(op: SendTransactionOperation, origin: TxOrigin, parentTask?: WrappedTask): Promise<string> {
        const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op, parentTask);

        const [txRequest, pxe, account, network, nonce, txCalls, txSetup] = await this.processTx(_op, _isFeePayer, parentTask);
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
        const txHash = await this.sendProvedTx(pxe, provedTx.toTx(), parentTask);

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

    async executeSimulateTransaction(op: SimulateTransactionOperation): Promise<unknown> {
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
    
    async executeSimulateUtility(op: SimulateUtilityOperation): Promise<AbiDecoded> {
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
            await pxe.registerContract({instance, artifact});
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
    
    async executeSimulateViews(op: SimulateViewsOperation): Promise<{encoded: Fr[][], decoded: AbiDecoded[]}> {
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
            encoded: Fr[][],
            decoded: AbiDecoded[],
        } = {
            encoded: [],
            decoded: [],
        };
        
        const args: HashedValues[] = [];
        const calls: [AzguardFunctionCall, number, number, AbiType[]][] = [];
        const utility: [Promise<UtilitySimulationResult>, number, AbiType[]][] = [];
        const ensureArray = (value: any): any[] => Array.isArray(value) ? value : [value];
        let privateCalls = 0;
        let publicCalls = 0;
        
        await account.ensureRegistered(pxe);

        for (let i = 0; i < op.calls.length; i++) {
            switch (op.calls[i].kind) {
                case ActionKind.Call: {
                    const _call = op.calls[i] as CallAction;
                    const instance = instances.get(_call.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.currentContractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract artifact not found");
                    }
                    const fn = artifact.functions.find(x => x.name === _call.method)
                        ?? artifact.nonDispatchPublicFunctions.find(x => x.name === _call.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    if (fn.functionType === FunctionType.UTILITY) {
                        utility.push([
                            pxe.simulateUtility(
                                _call.method,
                                _call.args,
                                AztecAddress.fromString(_call.contract),
                                undefined, // authwits
                                account.address,
                                [account.address],
                            ),
                            i,
                            fn.returnTypes,
                        ]);
                    }
                    else {
                        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                        const packedArgs = fn.functionType === FunctionType.PUBLIC
                            ? await HashedValues.fromCalldata([fnSelector.toField(), ...encodeArguments(fn, _call.args)])
                            : await HashedValues.fromArgs(encodeArguments(fn, _call.args));
                        args.push(packedArgs);
                        calls.push([
                            new AzguardFunctionCall(
                                AztecAddress.fromString(_call.contract),
                                fnSelector,
                                packedArgs.hash,
                                fn.functionType === FunctionType.PUBLIC,
                                fn.isStatic,
                            ),
                            i,
                            fn.functionType === FunctionType.PUBLIC ? (publicCalls++) : (privateCalls++),
                            fn.returnTypes,
                        ]);
                    }
                    this.logDebug("Call enqueued.");
                    break;
                }
                case ActionKind.EncodedCall: {
                    const _call = op.calls[i] as EncodedCallAction;
                    const instance = instances.get(_call.to);
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
                        if (selector.toString() === _call.selector) {
                            fn = _fn;
                            break;
                        }
                    }
                    if (!fn) {
                        for (const _fn of artifact.nonDispatchPublicFunctions) {
                            const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                            if (selector.toString() === _call.selector) {
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
                            decodedArgs = ensureArray(decodeFromAbiPatched(fn.parameters.map(x => x.type), _call.args.map(x => Fr.fromString(x))));
                        }
                        catch (error) {
                            this.logError("Failed to decode utility call args", fn.parameters, _call.args, error);
                            throw new Error(`Failed to decode utility "encoded_call" args: ${(error as Error)?.message}. Try to use "call" instead.`);
                        }
                        utility.push([
                            pxe.simulateUtility(
                                fn.name,
                                decodedArgs,
                                AztecAddress.fromString(_call.to),
                                undefined, // authwits
                                account.address,
                                [account.address],
                            ),
                            i,
                            fn.returnTypes,
                        ]);
                    }
                    else {
                        const packedArgs = fn.functionType === FunctionType.PUBLIC
                            ? await HashedValues.fromCalldata([FunctionSelector.fromString(_call.selector).toField(), ..._call.args.map(x => Fr.fromString(x))])
                            : await HashedValues.fromArgs(_call.args.map(x => Fr.fromString(x)));
                        args.push(packedArgs);
                        calls.push([
                            new AzguardFunctionCall(
                                AztecAddress.fromString(_call.to),
                                FunctionSelector.fromString(_call.selector),
                                packedArgs.hash,
                                fn.functionType === FunctionType.PUBLIC,
                                fn.isStatic,
                            ),
                            i,
                            fn.functionType === FunctionType.PUBLIC ? (publicCalls++) : (privateCalls++),
                            fn.returnTypes,
                        ]);
                    }
                    this.logDebug("EncodedCall enqueued.");
                    break;
                }
            }
        }

        if (calls.length) {
            const txRequest = await account.buildTxExecutionRequest(pxe, [], false, calls.map(x => x[0]), args, Fr.zero());
            const simulatedTx = await pxe.simulateTx(
                txRequest, // txRequest
                true, // simulatePublic
                undefined, // skipTxValidation
                true, // skipFeeEnforcement
                undefined, // overrides
                [account.address], // scopes
            );

            const publicReturn = simulatedTx.getPublicReturnValues();
            const privateReturn = txRequest.origin.toString() === op.accountAddress
                ? simulatedTx.getPrivateReturnValues().nested
                : simulatedTx.getPrivateReturnValues().nested[1].nested;
            
            for (const [call, i, j, types] of calls) {
                const values = (call.is_public ? publicReturn[j] : privateReturn[j]).values ?? [];
                result.encoded[i] = values;
                try {
                    result.decoded[i] = decodeFromAbiPatched(types, values);
                }
                catch (error) {
                    this.logError("Failed to decode simulation results", types, values, error);
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
                            visibility: "public"
                        })),
                    } as any,
                    [values], // TODO: change to "ensureArray(values)" when aztec supports multi-type decoding
                );
            }
            catch (error) {
                this.logError("Failed to encode utility simulation results", types, values, error);
            }
            result.decoded[i] = values;
        }

        return result;
    }
    
    async processTx(
        op: {
            networkId: string,
            accountAddress: string,
            actions: IAction[],
            setup?: IAction[],
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
            txRequest = await account.buildTxExecutionRequest(pxe, setup, isFeePayer, calls, args, nonce, authwits, capsules);
            processingTask.complete();
        } catch (error) {
            const errorMessage = (error as Error)?.message ?? error as string ?? "Transaction processing failed";
            processingTask.fail(errorMessage);
            throw error;
        }

        return [txRequest, pxe, account, network, nonce, txCalls, txSetup];
    }

    async processTxActions(
        actions: IAction[],
        capsules: Capsule[],
        authwits: AuthWitness[],
        account: IAccountContract,
        nodeInfo: NodeInfo,
        instances: Map<string, ContractInstanceWithAddress>,
        artifacts: Map<string, ContractArtifact>,
        args: HashedValues[],
        calls: AzguardFunctionCall[],
        txCalls: TxCall[]
    ) {
        for (const action of actions) {
            switch (action.kind) {
                case ActionKind.AddCapsule: {
                    const _action = action as AddCapsuleAction;
                    this.logDebug("Adding capsule...");
                    capsules.push(new Capsule(
                        AztecAddress.fromString(_action.contract),
                        Fr.fromString(_action.storageSlot),
                        _action.capsule.map(Fr.fromString)
                    ));
                    this.logDebug("Capsule added.");
                    break;
                }
                case ActionKind.AddPrivateAuthwit: {
                    const _action = action as AddPrivateAuthwitAction;
                    this.logDebug("Adding private authwit...");

                    let messageHash: Fr;
                    switch (_action.content.kind) {
                        case AuthwitContentKind.Call: {
                            const _content = _action.content as CallAuthwitContent;
                            messageHash = await this.getCallMessageHash(_content, nodeInfo, instances, artifacts);
                            // await this.accountStateService.addCallAuthwit(
                            //     account.address.toString(), messageHash.toString(), _content.caller, _content.contract, _content.method, _content.args, false,
                            // );
                            break;
                        }
                        case AuthwitContentKind.EncodedCall: {
                            const _content = _action.content as EncodedCallAuthwitContent;
                            messageHash = await this.getEncodedCallMessageHash(_content, nodeInfo, instances, artifacts);
                            // await this.accountStateService.addCallAuthwit(
                            //     account.address.toString(), messageHash.toString(), _content.caller, _content.to, _content.selector, _content.args, false,
                            // );
                            break;
                        }
                        case AuthwitContentKind.Intent: {
                            const _content = _action.content as IntentAuthwitContent;
                            messageHash = await this.getIntentMessageHash(_content, nodeInfo);
                            // await this.accountStateService.addIntentAuthwit(
                            //     account.address.toString(), messageHash.toString(), _content.consumer, _content.intent, false,
                            // );
                            break;
                        }
                        case AuthwitContentKind.MessageHash: {
                            const _content = _action.content as MessageHashAuthwitContent;
                            messageHash = Fr.fromString(_content.messageHash);
                            // await this.accountStateService.addAuthwit(
                            //     account.address.toString(), messageHash.toString(), false,
                            // );
                            break;
                        }
                        default: {
                            throw new Error("Invalid authwit content kind");
                        }
                    }

                    const authwit = _action.authwit
                        ? new AuthWitness(messageHash, _action.authwit.map(x => Fr.fromString(x)))
                        : await account.buildAuthWitness(messageHash);
                    
                    authwits.push(authwit);

                    this.logDebug("Private authwit added.");
                    break;
                }
                case ActionKind.AddPublicAuthwit: {
                    const _action = action as AddPublicAuthwitAction;
                    this.logDebug("Adding public authwit...");
                    
                    let messageHash: Fr;
                    switch (_action.content.kind) {
                        case AuthwitContentKind.Call: {
                            const _content = _action.content as CallAuthwitContent;
                            messageHash = await this.getCallMessageHash(_content, nodeInfo, instances, artifacts);
                            await this.accountStateService.addCallAuthwit(
                                account.address.toString(), messageHash.toString(), _content.caller, _content.contract, _content.method, _content.args, true,
                            );
                            break;
                        }
                        case AuthwitContentKind.EncodedCall: {
                            const _content = _action.content as EncodedCallAuthwitContent;
                            messageHash = await this.getEncodedCallMessageHash(_content, nodeInfo, instances, artifacts);
                            await this.accountStateService.addCallAuthwit(
                                account.address.toString(), messageHash.toString(), _content.caller, _content.to, _content.selector, _content.args, true,
                            );
                            break;
                        }
                        case AuthwitContentKind.Intent: {
                            const _content = _action.content as IntentAuthwitContent;
                            messageHash = await this.getIntentMessageHash(_content, nodeInfo);
                            await this.accountStateService.addIntentAuthwit(
                                account.address.toString(), messageHash.toString(), _content.consumer, _content.intent, true,
                            );
                            break;
                        }
                        case AuthwitContentKind.MessageHash: {
                            const _content = _action.content as MessageHashAuthwitContent;
                            messageHash = Fr.fromString(_content.messageHash);
                            await this.accountStateService.addAuthwit(
                                account.address.toString(), messageHash.toString(), true,
                            );
                            break;
                        }
                        default: {
                            throw new Error("Invalid authwit content kind");
                        }
                    }

                    const fn = getSetAuthorizedFn();
                    const packedArgs = fn.functionType === FunctionType.PUBLIC
                        ? await HashedValues.fromCalldata([(await getSetAuthorizedSelector()).toField(), ...encodeArguments(fn, [messageHash, true])])
                        : await HashedValues.fromArgs(encodeArguments(fn, [messageHash, true]));
                    args.push(packedArgs);
                    calls.push(new AzguardFunctionCall(
                        getAuthRegistryAddress(),
                        await getSetAuthorizedSelector(),
                        packedArgs.hash,
                        fn.functionType === FunctionType.PUBLIC,
                        fn.isStatic,
                    ));
                    txCalls.push(new TxCall(
                        getAuthRegistryAddress().toString(),
                        fn.name,
                        [messageHash, true],
                    ));

                    this.logDebug("Public authwit added.");
                    break;
                }
                case ActionKind.Call: {
                    const _action = action as CallAction;
                    const instance = instances.get(_action.contract);
                    if (!instance) {
                        throw new Error("Contract not found");
                    }
                    const artifact = artifacts.get(instance.currentContractClassId.toString());
                    if (!artifact) {
                        throw new Error("Contract artifact not found");
                    }
                    const fn = artifact.functions.find(x => x.name === _action.method)
                        ?? artifact.nonDispatchPublicFunctions.find(x => x.name === _action.method);
                    if (!fn) {
                        throw new Error("Method not found");
                    }
                    const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                    const packedArgs = fn.functionType === FunctionType.PUBLIC
                        ? await HashedValues.fromCalldata([fnSelector.toField(), ...encodeArguments(fn, _action.args)])
                        : await HashedValues.fromArgs(encodeArguments(fn, _action.args));
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
                    this.logDebug("Call enqueued.");
                    break;
                }
                case ActionKind.EncodedCall: {
                    const _action = (action as EncodedCallAction)!;
                    if (_action.type === undefined || _action.isStatic === undefined) {
                        const instance = instances.get(_action.to);
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
                            if (selector.toString() === _action.selector) {
                                fn = _fn;
                                break;
                            }
                        }
                        if (!fn) {
                            for (const _fn of artifact.nonDispatchPublicFunctions) {
                                const selector = await FunctionSelector.fromNameAndParameters(_fn.name, _fn.parameters);
                                if (selector.toString() === _action.selector) {
                                    fn = _fn;
                                    break;
                                }
                            }
                        }
                        if (!fn) {
                            throw new Error("Method not found");
                        }
                        _action.type = fn.functionType;
                        _action.isStatic = fn.isStatic;
                    }
                    const packedArgs = _action.type === FunctionType.PUBLIC
                        ? await HashedValues.fromCalldata([FunctionSelector.fromString(_action.selector).toField(), ..._action.args.map(x => Fr.fromString(x))])
                        : await HashedValues.fromArgs(_action.args.map(x => Fr.fromString(x)));
                    args.push(packedArgs);
                    calls.push(new AzguardFunctionCall(
                        AztecAddress.fromString(_action.to),
                        FunctionSelector.fromString(_action.selector),
                        packedArgs.hash,
                        _action.type === FunctionType.PUBLIC,
                        _action.isStatic,
                    ));
                    txCalls.push(new TxCall(
                        _action.to,
                        _action.selector,
                        _action.args,
                    ));
                    this.logDebug("EncodedCall enqueued.");
                    break;
                }
            }
        }
    }

    /**
     * Wrapper around pxe.simulateTx with task tracking.
     */
    async simulateTxRequest(
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
            const errorMessage = (error as Error)?.message ?? error as string ?? "Simulation failed";
            simulationTask.fail(errorMessage);
            throw error;
        }
        return simulatedTx;
    }

    /**
     * Wrapper around pxe.proveTx with task tracking.
     */
    async proveTxRequest(
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
            const errorMessage = (error as Error)?.message ?? error as string ?? "Proof generation failed";
            provingTask.fail(errorMessage);
            throw error;
        }
        return provedTx;
    }

    /**
     * Wrapper around pxe.sendTx with task tracking.
     */
    async sendProvedTx(
        pxe: PXE,
        tx: Tx,
        parentTask?: WrappedTask,
    ): Promise<TxHash> {
        let txHash: TxHash;
        const sendingStep = new StepContent("Sending transaction");
        const sendingTask = parentTask
            ? parentTask.startSubtask(sendingStep)
            : this.taskService.startNewTask(sendingStep);
        try {
            txHash = await pxe.sendTx(tx);
            sendingTask.complete();
        } catch (error) {
            const errorMessage = (error as Error)?.message ?? error as string ?? "Transaction sending failed";
            sendingTask.fail(errorMessage);
            throw error;
        }
        return txHash;
    }

    async getCallMessageHash(
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
        const fn = artifact.functions.find(x => x.name === content.method)
            ?? artifact.nonDispatchPublicFunctions.find(x => x.name === content.method);
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

    async getEncodedCallMessageHash(
        content: EncodedCallAuthwitContent,
        nodeInfo: NodeInfo,
        instances: Map<string, ContractInstanceWithAddress>,
        artifacts: Map<string, ContractArtifact>,
    ): Promise<Fr> {
        if (content.name === undefined ||
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

    async getIntentMessageHash(
        content: IntentAuthwitContent,
        nodeInfo: NodeInfo,
    ): Promise<Fr> {
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

    private getContracts(actions: IAction[]) {
        return [...new Set(
            (
                actions
                    .filter(x => x.kind === ActionKind.AddPrivateAuthwit && (x as AddPrivateAuthwitAction).content.kind === AuthwitContentKind.Call)
                    .map(x => ((x as AddPrivateAuthwitAction).content as CallAuthwitContent).contract)
            )
            .concat(
                actions
                    .filter(x => x.kind === ActionKind.AddPrivateAuthwit && (x as AddPrivateAuthwitAction).content.kind === AuthwitContentKind.EncodedCall)
                    .map(x => ((x as AddPrivateAuthwitAction).content as EncodedCallAuthwitContent).to)
            )
            .concat(
                actions
                    .filter(x => x.kind === ActionKind.AddPublicAuthwit && (x as AddPublicAuthwitAction).content.kind === AuthwitContentKind.Call)
                    .map(x => ((x as AddPublicAuthwitAction).content as CallAuthwitContent).contract)
            )
            .concat(
                actions
                    .filter(x => x.kind === ActionKind.AddPublicAuthwit && (x as AddPublicAuthwitAction).content.kind === AuthwitContentKind.EncodedCall)
                    .map(x => ((x as AddPublicAuthwitAction).content as EncodedCallAuthwitContent).to)
            )
            .concat(
                actions
                    .filter(x => x.kind === ActionKind.Call)
                    .map(x => (x as CallAction).contract)
            )
            .concat(
                actions
                    .filter(x => x.kind === ActionKind.EncodedCall)
                    .map(x => (x as EncodedCallAction).to)
            )
        )];
    }

    private async getInstances(pxe: PXE, contracts: string[]): Promise<Map<string, ContractInstanceWithAddress>> {
        this.logDebug("Get instances...");
        const instances = new Map<string, ContractInstanceWithAddress>();
        this.logDebug(`Fetching ${contracts.length} instances...`);
        const fetched = await Promise.all(
            contracts.map(x => this.getInstance(pxe, x)),
        );
        this.logDebug(`${fetched.length} instances fetched`);
        for (const [address, instance] of fetched) {
            instances.set(address, instance);
        }
        return instances;
    }

    private async getInstance(pxe: PXE, contract: string): Promise<[string, ContractInstanceWithAddress]> {
        const metadata = await pxe.getContractMetadata(AztecAddress.fromString(contract))
        if (!metadata.contractInstance) {
            throw new Error("Contract instance not found");
        }
        return [contract, metadata.contractInstance];
    }

    private async getArtifacts(pxe: PXE, instances: Map<string, ContractInstanceWithAddress>): Promise<Map<string, ContractArtifact>> {
        this.logDebug("Get artifacts...");
        const artifacts = new Map<string, ContractArtifact>();
        const classIds = new Set(
            instances
                .values()
                .filter(x => !artifacts.has(x.currentContractClassId.toString()))
                .map(x => x.currentContractClassId.toString())
        );
        this.logDebug(`Fetching ${classIds.size} artifacts...`);
        const fetched = await Promise.all(
            classIds.values().map(x => this.getArtifact(pxe, x))
        );
        this.logDebug(`${fetched.length} artifacts fetched`);
        for (const [classId, artifact] of fetched) {
            artifacts.set(classId, artifact);
        }
        return artifacts;
    }

    private async getArtifact(pxe: PXE, classId: string): Promise<[string, ContractArtifact]> {
        const metadata = await pxe.getContractClassMetadata(Fr.fromString(classId))
        if (!metadata.artifact) {
            throw new Error("Contract artifact not found");
        }
        return [classId, metadata.artifact];
    }
}
