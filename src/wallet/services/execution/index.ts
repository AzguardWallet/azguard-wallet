import {
    computeInnerAuthWitHash,
    computeAuthWitMessageHash,
} from "@aztec/aztec.js";
import { Fr } from '@aztec/foundation/fields';
import {
    AbiDecoded,
    AbiType,
    AbiTypeSchema,
    ContractArtifact,
    ContractArtifactSchema,
    encodeArguments,
    FunctionSelector,
    FunctionType,
    FunctionCall,
} from "@aztec/stdlib/abi";
import { AuthWitness } from '@aztec/stdlib/auth-witness';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import {
    CompleteAddress,
    computeContractAddressFromInstance,
    ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    NodeInfo,
} from "@aztec/stdlib/contract";
import { PXE } from '@aztec/stdlib/interfaces/client';
import { Gas, GasFees, GasSettings } from "@aztec/stdlib/gas";
import { Capsule, HashedValues, TxExecutionRequest } from '@aztec/stdlib/tx';
import { z } from "zod";
import { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { NetworkService } from "@/wallet/services/network";
import { Network } from "@/wallet/services/network/client";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { AccountService } from "@/wallet/services/account";
import { AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";
import { ProfileService } from "@/wallet/services/profile";
import { AccountStateService } from "@/wallet/services/account-state";
import { TokenService } from "@/wallet/services/token";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "@/wallet/services/token/functions";
import { FpcService } from "@/wallet/services/fpc";
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
import { decodeFromAbiPatched } from "@/wallet/utils/abi-decoder";
import { Fn } from "@/wallet/utils/fn";
import { getFeeJuiceClaimPayload } from "@/wallet/utils/fee-juice";
import {
    EXECUTION_SERVICE_NAME,
    ExecutionServiceMethod,
    ExecuteTransferRequest,
    ExecuteTransferResponse,
    ExecuteOperationsRequest,
    ExecuteOperationsResponse,
    OperationKind,
    IOperation,
    GetCompleteAddressOperation,
    RegisterSenderOperation,
    RegisterContractOperation,
    SendTransactionOperation,
    SimulateTransactionOperation,
    SimulateUtilityOperation,
    SimulateViewsOperation,
    OperationStatus,
    IOperationResult,
    SkippedOperationResult,
    FailedOperationResult,
    OkOperationResult,
    AuthwitContentKind,
    CallAuthwitContent,
    EncodedCallAuthwitContent,
    IntentAuthwitContent,
    MessageHashAuthwitContent,
    ActionKind,
    IAction,
    AddCapsuleAction,
    AddPrivateAuthwitAction,
    AddPublicAuthwitAction,
    CallAction,
    EncodedCallAction,
    FeePaymentMethodType,
    FpcPaymentMethod,
    FeeJuiceWithClaimPaymentMethod,
    CustomPaymentMethod,
    FeeSettings,
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
        emit: (event: EventMessage) => void,
    ) {
        super(EXECUTION_SERVICE_NAME, emit);
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
                    return new ExecuteTransferResponse(_request, undefined, error.message);
                }
            }
            case ExecutionServiceMethod.ExecuteOperations: {
                const _request = request as ExecuteOperationsRequest;
                try {
                    const results = await this.executeOperations(_request.operations, _request.origin);
                    return new ExecuteOperationsResponse(_request, results);
                }
                catch (error: any) {
                    return new ExecuteOperationsResponse(_request, undefined, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
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
        const packedArgs = await fn.packArgs(args);
        const selector = await fn.getSelector();

        const op = new SendTransactionOperation(
            networkId,
            accountAddress,
            feeSettings,
            [
                new EncodedCallAction(
                    token.contract,
                    selector.toString(),
                    packedArgs.values.map(x => x.toString()),
                    fn.name,
                    fn.type,
                    fn.isStatic,
                    [],
                ),
            ],
        );

        const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op);

        const [txRequest, pxe, account, network, nonce, _, txSetup] = await this.processTx(_op, _isFeePayer);
        txRequest.txContext.gasSettings = _gasSettings;

        const simulatedTx = await pxe.simulateTx(
            txRequest, // txRequest
            true, // simulatePublic
            undefined, // msgSender
            undefined, // skipTxValidation
            undefined, // skipFeeEnforcement
            [account.address], // scopes
        );
        const provedTx = await pxe.proveTx(txRequest, simulatedTx.privateExecutionResult);
        const txHash = await pxe.sendTx(provedTx.toTx());

        const tx = await this.transactionService.addTransaction(
            new TxOrigin(OriginType.UI),
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

        return tx.hash;
    }

    public async executeOperations(operations: IOperation[], origin: TxOrigin): Promise<IOperationResult[]> {
        const results: IOperationResult[] = [];
        for (const operation of operations) {
            if (results.length && results.at(-1)!.status !== OperationStatus.Ok) {
                results.push(new SkippedOperationResult());
                continue;
            }
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
                    case OperationKind.SendTransaction: {
                        result = await this.executeSendTransaction(operation as SendTransactionOperation, origin);
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
                results.push(new OkOperationResult(result));
            }
            catch (error) {
                results.push(new FailedOperationResult((error as Error)?.message ?? error as string ?? "Unknown error"));
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
            throw new Error("Contract artifact doesn't match instance class id");
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

    async withFeePayment(op: SendTransactionOperation): Promise<[SendTransactionOperation, GasSettings, boolean]> {
        switch (op.feeSettings.paymentMethod.type) {
            case FeePaymentMethodType.FeeJuice: {
                if (op.setup?.length) {
                    throw new Error("Custom setup payload is not allowed with this fee payment method");
                }
                let [txRequest, pxe, account] = await this.processTx(op);
                const simulatedTx = await pxe.simulateTx(
                    txRequest, // txRequest
                    true, // simulatePublic
                    undefined, // msgSender
                    undefined, // skipTxValidation
                    true, // skipFeeEnforcement
                    [account.address], // scopes
                );
                const baseFees = await pxe.getCurrentBaseFees();
                const gasSettings = new GasSettings(
                    simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                    simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                    baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                    new GasFees(0, 0),
                );
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
                let [txRequest, pxe, account] = await this.processTx(op);
                const simulatedTx = await pxe.simulateTx(
                    txRequest, // txRequest
                    true, // simulatePublic
                    undefined, // msgSender
                    undefined, // skipTxValidation
                    true, // skipFeeEnforcement
                    [account.address], // scopes
                );
                const baseFees = await pxe.getCurrentBaseFees();
                const gasSettings = new GasSettings(
                    simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                    simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                    baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                    new GasFees(0, 0),
                );
                return [op, gasSettings, true];
            }
            case FeePaymentMethodType.Fpc: {
                if (op.setup?.length) {
                    throw new Error("Custom setup payload is not allowed with this fee payment method");
                }
                const { fpcId, inPublic } = op.feeSettings.paymentMethod as FpcPaymentMethod;
                const fpc = await this.fpcService.getFpc(fpcId);
                // first approach
                let [txRequest, pxe, account] = await this.processTx(op);
                let simulatedTx = await pxe.simulateTx(
                    txRequest, // txRequest
                    true, // simulatePublic
                    undefined, // msgSender
                    undefined, // skipTxValidation
                    true, // skipFeeEnforcement
                    [account.address], // scopes
                );
                const baseFees = await pxe.getCurrentBaseFees();
                let maxFee = simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)).computeFee(baseFees);
                op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                // precise estimation
                [txRequest] = await this.processTx(op);
                txRequest.txContext.gasSettings = new GasSettings(
                    simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)),
                    simulatedTx.gasUsed.teardownGas.add(fpc.getTeardownGas(inPublic)),
                    baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                    new GasFees(0, 0),
                );
                simulatedTx = await pxe.simulateTx(
                    txRequest, // txRequest
                    true, // simulatePublic
                    undefined, // msgSender
                    undefined, // skipTxValidation
                    true, // skipFeeEnforcement
                    [account.address], // scopes
                );
                maxFee = simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding).computeFee(baseFees);
                op.setup = fpc.getFeePayload(op.accountAddress, maxFee, inPublic);
                const gasSettings = new GasSettings(
                    simulatedTx.gasUsed.totalGas.mul(op.feeSettings.gasPadding),
                    simulatedTx.gasUsed.teardownGas.mul(op.feeSettings.gasPadding),
                    baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                    new GasFees(0, 0),
                );
                return [op, gasSettings, false];
            }
            case FeePaymentMethodType.Custom: {
                if (!op.setup?.length) {
                    throw new Error("Setup payload is missed");
                }
                const { teardownDaGas, teardownL2Gas } = op.feeSettings.paymentMethod as CustomPaymentMethod;
                let [txRequest, pxe, account] = await this.processTx(op);
                const baseFees = await pxe.getCurrentBaseFees();
                txRequest.txContext.gasSettings = new GasSettings(
                    txRequest.txContext.gasSettings.gasLimits,
                    new Gas(teardownDaGas, teardownL2Gas),
                    baseFees.mul(3), // TODO: remove multiplier when base fees are fixed
                    new GasFees(0, 0),
                );
                const simulatedTx = await pxe.simulateTx(
                    txRequest, // txRequest
                    true, // simulatePublic
                    undefined, // msgSender
                    undefined, // skipTxValidation
                    true, // skipFeeEnforcement
                    [account.address], // scopes
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
                return [op, gasSettings, isFeePayer];
            }
            default: {
                throw new Error("Invalid fee payment method");
            }
        }
    }

    async executeSendTransaction(op: SendTransactionOperation, origin: TxOrigin): Promise<string> {
        const [_op, _gasSettings, _isFeePayer] = await this.withFeePayment(op);

        const [txRequest, pxe, account, network, nonce, txCalls, txSetup] = await this.processTx(_op, _isFeePayer);
        txRequest.txContext.gasSettings = _gasSettings;

        const simulatedTx = await pxe.simulateTx(
            txRequest, // txRequest
            true, // simulatePublic
            undefined, // msgSender
            undefined, // skipTxValidation
            undefined, // skipFeeEnforcement
            [account.address], // scopes
        );
        const provedTx = await pxe.proveTx(txRequest, simulatedTx.privateExecutionResult);
        const txHash = await pxe.sendTx(provedTx.toTx());

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
            undefined, // msgSender
            undefined, // skipTxValidation
            true, // skipFeeEnforcement
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
            console.debug("Register contract");
            await pxe.registerContract({instance, artifact});
        }

        return await pxe.simulateUtility(
            op.method, // functionName
            op.args, // args
            AztecAddress.fromString(op.contract), // to
            undefined, // authwits
            undefined, // from
            [account.address], // scopes
        );
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
                console.debug("Register contract");
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
        const utility: [Promise<AbiDecoded>, number, AbiType[]][] = [];
        const ensureArray = (value: any): any[] => Array.isArray(value) ? value : [value];
        let privateCalls = 0;
        let publicCalls = 0;

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
                        throw new Error("Contract not found");
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
                    console.debug("Call enqueued.");
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
                        throw new Error("Contract not found");
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
                            console.error("Failed to decode utility call args", fn.parameters, _call.args, error);
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
                    console.debug("EncodedCall enqueued.");
                    break;
                }
            }
        }

        const txRequest = await account.buildTxExecutionRequest(pxe, [], false, calls.map(x => x[0]), args, Fr.zero());
        const simulatedTx = await pxe.simulateTx(
            txRequest, // txRequest
            true, // simulatePublic
            undefined, // msgSender
            undefined, // skipTxValidation
            true, // skipFeeEnforcement
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
                console.error("Failed to decode simulation results", types, values, error);
            }
        }

        for (const [promise, i, types] of utility) {
            const values = await promise;
            try {
                result.encoded[i] = encodeArguments(
                    {
                        parameters: types.map((x, ind) => ({
                            type: x,
                            name: `result${ind}`,
                            visibility: "public"
                        })),
                    } as any,
                    ensureArray(values),
                );
            }
            catch (error) {
                console.error("Failed to encode utility simulation results", types, values, error);
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
): Promise<[TxExecutionRequest, PXE, IAccountContract, Network, Fr, TxCall[], TxCall[]]> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

        const pxe = this.pxeService.getPXE(network);
        const nodeInfo = await pxe.getNodeInfo();
        const contracts = this.getContracts(op.actions.concat(op.setup ?? []));
        const instances = await this.getInstances(pxe, contracts);
        const artifacts = await this.getArtifacts(pxe, instances);

        const registeredContracts = new Set<string>((await pxe.getContracts()).map(x => x.toString()));
        for (const [contract, instance] of instances) {
            if (!registeredContracts.has(contract)) {
                console.debug("Register contract");
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
        const txCalls: TxCall[] = [];
        const txSetup: TxCall[] = [];

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

        const nonce = Fr.random();
        const txRequest = await account.buildTxExecutionRequest(pxe, setup, isFeePayer, calls, args, nonce);

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
        txCalls: TxCall[],
    ) {
        for (const action of actions) {
            switch (action.kind) {
                case ActionKind.AddCapsule: {
                    const _action = action as AddCapsuleAction;
                    console.debug("Adding capsule...");
                    capsules.push(new Capsule(
                        AztecAddress.fromString(_action.contract),
                        Fr.fromString(_action.storageSlot),
                        _action.capsule.map(Fr.fromString)
                    ));
                    console.debug("Capsule added.");
                    break;
                }
                case ActionKind.AddPrivateAuthwit: {
                    const _action = action as AddPrivateAuthwitAction;
                    console.debug("Adding private authwit...");

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

                    console.debug("Private authwit added.");
                    break;
                }
                case ActionKind.AddPublicAuthwit: {
                    const _action = action as AddPublicAuthwitAction;
                    console.debug("Adding public authwit...");
                    
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

                    console.debug("Public authwit added.");
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
                        throw new Error("Contract not found");
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
                    console.debug("Call enqueued.");
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
                            throw new Error("Contract not found");
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
                    console.debug("EncodedCall enqueued.");
                    break;
                }
            }
        }
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
            throw new Error("Contract not found");
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
                throw new Error("Contract not found");
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
                    .filter(x => x.kind === ActionKind.AddPublicAuthwit && (x as AddPublicAuthwitAction).content.kind === AuthwitContentKind.Call)
                    .map(x => ((x as AddPublicAuthwitAction).content as CallAuthwitContent).contract)
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
        console.debug("Get instances...");
        const instances = new Map<string, ContractInstanceWithAddress>();
        console.debug(`Fetching ${contracts.length} instances...`);
        const fetched = await Promise.all(
            contracts.map(x => this.getInstance(pxe, x)),
        );
        console.debug(`${fetched.length} instances fetched`);
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
        console.debug("Get artifacts...");
        const artifacts = new Map<string, ContractArtifact>();
        const classIds = new Set(
            instances
                .values()
                .filter(x => !artifacts.has(x.currentContractClassId.toString()))
                .map(x => x.currentContractClassId.toString())
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

    private async getArtifact(pxe: PXE, classId: string): Promise<[string, ContractArtifact]> {
        const metadata = await pxe.getContractClassMetadata(Fr.fromString(classId))
        if (!metadata.artifact) {
            throw new Error("Contract artifact not found");
        }
        return [classId, metadata.artifact];
    }
}