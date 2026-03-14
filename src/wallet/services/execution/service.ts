import { type IntentInnerHash, type CallIntent, computeAuthWitMessageHash, CallAuthorizationRequest } from "@aztec/aztec.js/authorization";
import type { InteractionWaitOptions, SendReturn } from "@aztec/aztec.js/contracts";
import type { SimulateTxOpts } from "@aztec/pxe/client/bundle";
import { Fr } from "@aztec/foundation/curves/bn254";
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
import { AuthWitness, computeInnerAuthWitHash } from "@aztec/stdlib/auth-witness";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import {
    type CompleteAddress,
    computeContractAddressFromInstance,
    type ContractInstanceWithAddress,
    ContractInstanceWithAddressSchema,
    getContractClassFromArtifact,
    type NodeInfo,
    computePartialAddress,
} from "@aztec/stdlib/contract";
import { Gas, GasFees, GasSettings } from "@aztec/stdlib/gas";
import {
    Capsule,
    ExecutionPayload,
    HashedValues,
    TxExecutionRequest,
    TxHash,
    TxProfileResult,
    TxReceipt,
    TxSimulationResult,
    UtilitySimulationResult,
    Tx,
    collectOffchainEffects,
} from "@aztec/stdlib/tx";
import z from "zod";
import { NetworkService, Network } from "@/wallet/services/network/service";
import { IPXE, PxeServiceClient } from "@/wallet/services/pxe/client";
import { AccountService } from "@/wallet/services/account/service";
import { AzguardFeePaymentMethod, AzguardFunctionCall, IAccountContract } from "@/wallet/services/account/contracts";
import { ContactService } from "@/wallet/services/contact/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { AuthRegistryService } from "@/wallet/services/auth-registry/service";
import { TokenService } from "@/wallet/services/token/service";
import {
    TransferPrivateFn,
    TransferPrivateToPublicFn,
    TransferPublicFn,
    TransferPublicToPrivateFn,
} from "@/wallet/services/token/functions";
import { FpcService, FpcType } from "@/wallet/services/fpc/service";
import { TransactionService, OriginType, TransferType, TxCall, LocalTxOrigin, TxStatus, TxGasDetails } from "@/wallet/services/transaction/service";
import { getAuthRegistryAddress, getSetAuthorizedFn, getSetAuthorizedSelector } from "@/wallet/utils/auth-registry";
import type { Fn } from "@/wallet/utils/fn";
import { feeJuiceAddress, getFeeJuiceClaimPayload } from "@/wallet/utils/fee-juice";
import { computeMaxFee, formatFeeJuice, feeToUsd } from "@/utils/fee-estimation";
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
    PRIORITY_MULTIPLIERS,
    type AztecGetContractClassMetadataOperation,
    type AztecGetContractMetadataOperation,
    type AztecGetPrivateEventsOperation,
    type AztecGetChainInfoOperation,
    type AztecRegisterSenderOperation,
    type AztecGetAddressBookOperation,
    type AztecRegisterContractOperation,
    type AztecSimulateTxOperation,
    type AztecSimulateUtilityOperation,
    type AztecProfileTxOperation,
    type AztecSendTxOperation,
    type AztecCreateAuthWitOperation,
    type AddCapsuleAction,
    type AddExtraArgsAction,
    type EncodedCallAction,
    type FeeOptions,
    type FeePaymentMethod,
    type GasBalances,
    type TransferFeeEstimate,
} from "./spec";
import { AztecNode } from "@aztec/stdlib/interfaces/client";
import { ChainInfo } from "@aztec/entrypoints/interfaces";
import { Aliased, ProfileOptions, SendOptions, SimulateOptions } from "@aztec/aztec.js/wallet";
import { PackedPrivateEvent } from "@aztec/pxe/client/bundle";

export * from "./spec";

// Default multiplier for maxFeesPerGas (backwards-compatible)
const DEFAULT_FEE_MULTIPLIER = 2;

/** Extract estimated fee from finalized gas settings on a TxExecutionRequest. */
function getEstimatedFee(txRequest: TxExecutionRequest): string {
    const gs = txRequest.txContext.gasSettings;
    return computeMaxFee(
        { daGas: gs.gasLimits.daGas, l2Gas: gs.gasLimits.l2Gas },
        { daGas: gs.teardownGasLimits.daGas, l2Gas: gs.teardownGasLimits.l2Gas },
        { feePerDaGas: gs.maxFeesPerGas.feePerDaGas, feePerL2Gas: gs.maxFeesPerGas.feePerL2Gas },
    ).toString();
}

/** Extract gas breakdown from finalized gas settings. */
function getGasDetails(txRequest: TxExecutionRequest): TxGasDetails {
    const gs = txRequest.txContext.gasSettings;
    return {
        l2GasLimit: gs.gasLimits.l2Gas,
        daGasLimit: gs.gasLimits.daGas,
        teardownL2GasLimit: gs.teardownGasLimits.l2Gas,
        teardownDaGasLimit: gs.teardownGasLimits.daGas,
        feePerL2Gas: gs.maxFeesPerGas.feePerL2Gas.toString(),
        feePerDaGas: gs.maxFeesPerGas.feePerDaGas.toString(),
    };
}

export class ExecutionService extends Service<Methods> implements ServiceSpec<Methods> {
    public static name = EXECUTION_SERVICE_NAME;

    private pxeService: PxeServiceClient = null!;
    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private contactService: ContactService = null!;
    private tokenService: TokenService = null!;
    private fpcService: FpcService = null!;
    private transactionService: TransactionService = null!;
    private authRegistryService: AuthRegistryService = null!;
    private taskService: TaskService = null!;

    /** TTL cache for gas balance queries (survives popup reopens). */
    private static readonly GAS_BALANCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    private gasBalanceCache = new Map<string, { result: GasBalances; fetchedAt: number }>();

    public constructor(logger: ILogger) {
        super(EXECUTION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.pxeService = new PxeServiceClient(this.logger);
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.contactService = services.get(ContactService.name);
        this.tokenService = services.get(TokenService.name);
        this.fpcService = services.get(FpcService.name);
        this.transactionService = services.get(TransactionService.name);
        this.authRegistryService = services.get(AuthRegistryService.name);
        this.taskService = services.get(TaskService.name);

        // Invalidate gas balance cache when a transaction settles
        this.transactionService.onTransactionUpdated.add((tx) => {
            if (tx.status !== TxStatus.Pending) {
                for (const key of this.gasBalanceCache.keys()) {
                    if (key.endsWith(`:${tx.account}`)) {
                        this.gasBalanceCache.delete(key);
                    }
                }
            }
        });
    }

    private async buildTransferOperation(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): Promise<{ op: SendTransactionOperation; token: any; fn: Fn; args: any[] }> {
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

        const op: SendTransactionOperation = {
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

        return { op, token, fn, args };
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
        const origin: LocalTxOrigin = { type: OriginType.UI };
        const transferContent = new TransferContent(tokenId, transferType, accountAddress, recipientAddress, amount);
        const transferTask = this.taskService.startNewTask(transferContent, undefined, origin);

        try {
            const { op, token, fn, args } = await this.buildTransferOperation(
                networkId, accountAddress, tokenId, transferType, recipientAddress, amount, feeSettings,
            );

            const [txRequest, node, pxe, account, network, nonce, __, feePaymentMethod] =
                await this.buildAndEstimateTxRequest(op, op.feeSettings, transferTask);

            const provedTx = await this.proveTxTask(pxe, txRequest, [account.address], transferTask);

            const tx = await provedTx.toTx();
            await this.sendTxTask(node, tx, transferTask);

            const txHash = tx.getTxHash().toString();
            await this.transactionService.addTransaction(
                origin,
                network.chainId,
                accountAddress,
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
                feePaymentMethod,
                txHash,
                getEstimatedFee(txRequest),
                getGasDetails(txRequest),
            );
            transferTask.complete();
            return txHash;
        } catch (error) {
            transferTask.fail(error);
            throw error;
        }
    }

    public async estimateTransferFee(
        networkId: string,
        accountAddress: string,
        tokenId: number,
        transferType: TransferType,
        recipientAddress: string,
        amount: bigint,
        feeSettings: FeeSettings,
    ): Promise<TransferFeeEstimate> {
        await this.ensureInitialized();
        amount = BigInt(amount);

        const { op } = await this.buildTransferOperation(
            networkId, accountAddress, tokenId, transferType, recipientAddress, amount, feeSettings,
        );

        // Clone actions to prevent mutation side effects from FPC/FJWC fee payload prepending
        op.actions = [...op.actions];

        const [txRequest] = await this.buildAndEstimateTxRequest(op, op.feeSettings);

        const maxFeeRaw = BigInt(getEstimatedFee(txRequest));
        return {
            maxFee: maxFeeRaw.toString(),
            maxFeeFormatted: formatFeeJuice(maxFeeRaw),
            maxFeeUsd: feeToUsd(maxFeeRaw),
            gasDetails: getGasDetails(txRequest),
        };
    }

    public async estimateOperationFee(
        operation: Operation,
        feeSettings: FeeSettings,
    ): Promise<TransferFeeEstimate> {
        await this.ensureInitialized();

        if (operation.kind !== "send_transaction" && operation.kind !== "aztec_sendTx") {
            throw new Error("Only send_transaction and aztec_sendTx operations support fee estimation");
        }

        // Build actions array — clone to prevent mutation side effects
        let actions: Action[];
        if (operation.kind === "aztec_sendTx") {
            const [processedActions] = await this.processAztecJsPayload(
                (operation as any).exec,
                (operation as any).opts ?? {},
            );
            actions = [...processedActions];
        } else {
            actions = [...(operation as SendTransactionOperation).actions];
        }

        // Attempt single-pass auth witness discovery via offchain effects.
        // If the discovery simulation itself fails on a missing auth witness
        // (contracts using inline verify_private_authwit), extract the hash
        // and fall through to the retry loop below.
        try {
            const authWitActions = await this.discoverRequiredAuthWitnesses(
                { ...operation, actions: [...actions] } as any,
            );
            if (authWitActions.length) {
                this.logDebug(`[estimateOperationFee] Discovered ${authWitActions.length} auth witness(es) via offchain effects`);
                actions.push(...authWitActions);
            }
        } catch (discoveryError) {
            const hash = this.extractAuthWitHash(discoveryError);
            if (hash) {
                this.logDebug(`[estimateOperationFee] Discovery hit inline auth wit check, extracted hash ${hash}`);
                actions.push({
                    kind: "add_private_authwit",
                    content: { kind: "message_hash", messageHash: hash },
                } as AddPrivateAuthwitAction);
            }
            // Non-auth-wit errors: let estimation below surface them
        }

        // TODO: Remove retry loop once Aztec contracts emit auth witness requests
        // via offchain effects instead of inline verify_private_authwit. At that point
        // discoverRequiredAuthWitnesses will find all needed witnesses in one pass.
        const MAX_AUTH_WIT_RETRIES = 5;
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_AUTH_WIT_RETRIES; attempt++) {
            try {
                const op = { ...operation, actions: [...actions] } as any;
                const [txRequest] = await this.buildAndEstimateTxRequest(op, feeSettings);

                const maxFeeRaw = BigInt(getEstimatedFee(txRequest));
                return {
                    maxFee: maxFeeRaw.toString(),
                    maxFeeFormatted: formatFeeJuice(maxFeeRaw),
                    maxFeeUsd: feeToUsd(maxFeeRaw),
                    gasDetails: getGasDetails(txRequest),
                };
            } catch (error) {
                lastError = error;
                const missingHash = this.extractAuthWitHash(error);
                if (!missingHash || attempt === MAX_AUTH_WIT_RETRIES) {
                    throw error;
                }
                this.logDebug(`[estimateOperationFee] Missing auth witness for ${missingHash}, adding (attempt ${attempt + 1})`);
                actions.push({
                    kind: "add_private_authwit",
                    content: { kind: "message_hash", messageHash: missingHash },
                } as AddPrivateAuthwitAction);
            }
        }
        throw lastError;
    }

    private extractPrimaryMethod(operation: Operation): string | undefined {
        if ('actions' in operation && Array.isArray(operation.actions)) {
            const call = operation.actions.find((a: any) => a.kind === 'call' || a.kind === 'encoded_call');
            if (call?.kind === 'call') return call.method;
            if (call?.kind === 'encoded_call') return call.name ?? call.selector;
        }
        if ('exec' in operation && (operation as any).exec?.calls?.length) {
            const first = (operation as any).exec.calls[0];
            return first.name?.toString() ?? first.selector?.toString();
        }
        return undefined;
    }

    public async executeOperations(
        operations: Operation[],
        origin: LocalTxOrigin,
        parentTask?: WrappedTask,
    ): Promise<OperationResult[]> {
        await this.ensureInitialized();
        const results: OperationResult[] = [];
        for (const operation of operations) {
            if (results.length && results.at(-1)!.status !== "ok") {
                results.push({ status: "skipped" });
                continue;
            }

            const content = new ExecuteOperationContent(operation.kind, this.extractPrimaryMethod(operation));
            const operationTask = parentTask
                ? parentTask.startSubtask(content)
                : this.taskService.startNewTask(content, undefined, origin);

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
                    // Aztec.js interface:
                    case "aztec_getContractClassMetadata": {
                        result = await this.executeAztecGetContractClassMetadata(operation);
                        break;
                    }
                    case "aztec_getContractMetadata": {
                        result = await this.executeAztecGetContractMetadata(operation);
                        break;
                    }
                    case "aztec_getPrivateEvents": {
                        result = await this.executeAztecGetPrivateEvents(operation);
                        break;
                    }
                    case "aztec_getChainInfo": {
                        result = await this.executeAztecGetChainInfo(operation);
                        break;
                    }
                    case "aztec_registerSender": {
                        result = await this.executeAztecRegisterSender(operation);
                        break;
                    }
                    case "aztec_getAddressBook": {
                        result = await this.executeAztecGetAddressBook(operation);
                        break;
                    }
                    case "aztec_registerContract": {
                        result = await this.executeAztecRegisterContract(operation);
                        break;
                    }
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
                        result = await this.executeAztecSendTx(operation, origin, operationTask);
                        break;
                    }
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
            (await this.pxeService.getContractInstance(network, AztecAddress.fromString(op.address)));
        if (!instance) {
            throw new Error("Contract instance not found");
        }

        const providedArtifact = await ContractArtifactSchema.optional().parseAsync(op.artifact);
        const artifact =
            providedArtifact ??
            (await this.pxeService.getContractArtifact(network, instance.currentContractClassId));
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

        await this.pxeService.registerContract(network, { instance, artifact });
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
        origin: LocalTxOrigin,
        parentTask?: WrappedTask,
    ): Promise<string> {
        await this.ensureInitialized();

        const [txRequest, node, pxe, account, network, nonce, txCalls, feePaymentMethod] =
            await this.buildAndEstimateTxRequest(op, op.feeSettings, parentTask);

        const provedTx = await this.proveTxTask(pxe, txRequest, [account.address], parentTask);

        const tx = await provedTx.toTx();
        await this.sendTxTask(node, tx, parentTask);

        const txHash = tx.getTxHash().toString();
        await this.transactionService.addTransaction(
            origin,
            network.chainId,
            account.address.toString(),
            txCalls,
            nonce.toString(),
            feePaymentMethod,
            txHash,
            getEstimatedFee(txRequest),
            getGasDetails(txRequest),
        );

        return txHash;
    }

    private async executeSimulateTransaction(op: SimulateTransactionOperation): Promise<unknown> {
        const [txRequest, _, pxe, account] = await this.buildTxRequest(op, AzguardFeePaymentMethod.FeeJuice);
        const simulatedTx = await pxe.simulateTx(txRequest, {
            simulatePublic: op.simulatePublic ?? false,
            skipFeeEnforcement: true,
            scopes: [account.address],
        });
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

        const [_, instance] = await this.getInstance(pxe, op.contract);
        const [__, artifact] = await this.getArtifact(pxe, instance.currentContractClassId.toString());

        const fn =
            artifact.functions.find(x => x.name === op.method) ??
            artifact.nonDispatchPublicFunctions.find(x => x.name === op.method);
        if (!fn) {
            throw new Error("Method not found");
        }
        const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
        const encodedArgs = encodeArguments(fn, op.args);
        const call = new FunctionCall(
            fn.name,
            AztecAddress.fromString(op.contract),
            fnSelector,
            fn.functionType,
            false,
            fn.isStatic,
            encodedArgs,
            fn.returnTypes,
        );

        await account.ensureRegistered(pxe);
        const { result } = await pxe.simulateUtility(call, {
            scopes: [account.address],
        });

        try {
            return decodeFromAbi(fn.returnTypes, result);
        } catch (error) {
            this.logError("Failed to decode simulation results", fn.returnTypes, result, getErrorMessage(error));
            return result as any;
        }
    }

    public async executeSimulateViews(op: SimulateViewsOperation): Promise<{ encoded: Fr[][]; decoded: AbiDecoded[] }> {
        await this.ensureInitialized();
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);

        const node = await this.networkService.getNode(network.chainId);
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
                    const fnSelector = await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters);
                    const encodedArgs = encodeArguments(fn, call.args);
                    if (fn.functionType === FunctionType.UTILITY) {
                        utility.push([
                            pxe.simulateUtility(
                                new FunctionCall(
                                    fn.name,
                                    AztecAddress.fromString(call.contract),
                                    fnSelector,
                                    fn.functionType,
                                    false,
                                    fn.isStatic,
                                    encodedArgs,
                                    fn.returnTypes,
                                ),
                                { scopes: [account.address] },
                            ),
                            i,
                            fn.returnTypes,
                        ]);
                    } else {
                        const packedArgs =
                            fn.functionType === FunctionType.PUBLIC
                                ? await HashedValues.fromCalldata([fnSelector.toField(), ...encodedArgs])
                                : await HashedValues.fromArgs(encodedArgs);
                        args.push(packedArgs);
                        calls.push([
                            new AzguardFunctionCall(
                                AztecAddress.fromString(call.contract),
                                fnSelector,
                                packedArgs.hash,
                                fn.functionType === FunctionType.PUBLIC,
                                fn.isStatic,
                                call.hideSender === true,
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
                        utility.push([
                            pxe.simulateUtility(
                                new FunctionCall(
                                    fn.name,
                                    AztecAddress.fromString(call.to),
                                    FunctionSelector.fromString(call.selector),
                                    fn.functionType,
                                    false,
                                    fn.isStatic,
                                    call.args.map(x => Fr.fromString(x)),
                                    fn.returnTypes,
                                ),
                                { scopes: [account.address] },
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
                                call.hideMsgSender === true,
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
                node,
                pxe,
                calls.map(x => x[0]),
                Fr.random(),
                AzguardFeePaymentMethod.FeeJuice,
                args,
            );
            const simulatedTx = await pxe.simulateTx(txRequest, {
                simulatePublic: true,
                skipFeeEnforcement: true,
                scopes: [account.address],
            });

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
                result.decoded[i] = decodeFromAbi(types, values);
            } catch (error) {
                this.logError("Failed to encode utility simulation results", types, values, getErrorMessage(error));
            }
            result.encoded[i] = values;
        }

        return result;
    }

    public async getGasBalances(networkId: string, accountAddress: string, forceRefresh?: boolean): Promise<GasBalances> {
        await this.ensureInitialized();

        const cacheKey = `${networkId}:${accountAddress}`;
        if (!forceRefresh) {
            const cached = this.gasBalanceCache.get(cacheKey);
            if (cached && Date.now() - cached.fetchedAt < ExecutionService.GAS_BALANCE_TTL_MS) {
                return cached.result;
            }
        }

        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(networkId);

        // Public FeeJuice balance via balance_of_public on the FeeJuice contract
        let publicFeeJuice = "0";
        try {
            const publicResult = await this.executeSimulateViews({
                kind: "simulate_views",
                networkId,
                accountAddress,
                calls: [{
                    kind: "call",
                    contract: feeJuiceAddress,
                    method: "balance_of_public",
                    args: [accountAddress],
                }],
            });
            if (publicResult.encoded[0]?.[0]) {
                publicFeeJuice = publicResult.encoded[0][0].toBigInt().toString();
            }
        } catch (err) {
            this.logError("Failed to get public FeeJuice balance", getErrorMessage(err));
        }

        // Private FeeJuice balance via balance_of on BridgedFPC
        let privateFeeJuice: string | null = null;
        try {
            const fpcs = await this.fpcService.getFpcs(network.chainId);
            const bridgedFpc = fpcs.find(f => f.type === FpcType.BridgedFpc);
            if (bridgedFpc) {
                const privateResult = await this.executeSimulateViews({
                    kind: "simulate_views",
                    networkId,
                    accountAddress,
                    calls: [{
                        kind: "call",
                        contract: bridgedFpc.address,
                        method: "balance_of",
                        args: [accountAddress],
                    }],
                });
                if (privateResult.encoded[0]?.[0]) {
                    privateFeeJuice = privateResult.encoded[0][0].toBigInt().toString();
                }
            }
        } catch (err) {
            this.logError("Failed to get private FeeJuice balance", getErrorMessage(err));
        }

        const result = { publicFeeJuice, privateFeeJuice };
        this.gasBalanceCache.set(cacheKey, { result, fetchedAt: Date.now() });
        return result;
    }

    // Aztec.js interface:

    private async executeAztecGetContractClassMetadata(
        op: AztecGetContractClassMetadataOperation,
    ): Promise<{ isContractClassPubliclyRegistered: boolean; isArtifactRegistered: boolean }> {
        const network = await this.networkService.getNetwork(op.networkId);
        const artifact = await this.pxeService.getContractArtifact(network, op.id, { pxeOnly: true });
        return {
            isContractClassPubliclyRegistered: !!artifact,
            isArtifactRegistered: !!artifact,
        };
    }

    private async executeAztecGetContractMetadata(
        op: AztecGetContractMetadataOperation,
    ): Promise<{ instance?: ContractInstanceWithAddress; isContractInitialized: boolean; isContractPublished: boolean; isContractUpdated: boolean; updatedContractClassId?: Fr }> {
        const network = await this.networkService.getNetwork(op.networkId);

        // Check PXE-local only: simulation requires both instance AND artifact
        // registered in PXE. The full cascade (node/known/registry) finds on-chain
        // data that PXE can't use for simulation.
        const localInstance = await this.pxeService.getContractInstance(network, op.address, { pxeOnly: true });

        let hasArtifact = false;
        if (localInstance) {
            try {
                const artifact = await this.pxeService.getContractArtifact(network, localInstance.currentContractClassId, { pxeOnly: true });
                hasArtifact = !!artifact;
            } catch {
                hasArtifact = false;
            }
        }

        const isLocallyRegistered = !!localInstance && hasArtifact;

        // Use full cascade only for isContractPublished (on-chain existence)
        let isPublished = isLocallyRegistered;
        if (!isPublished) {
            const fullInstance = await this.pxeService.getContractInstance(network, op.address);
            isPublished = !!fullInstance;
        }

        return {
            instance: isLocallyRegistered ? localInstance : undefined,
            isContractInitialized: isLocallyRegistered,
            isContractPublished: isPublished,
            isContractUpdated: false,
            updatedContractClassId: undefined,
        };
    }

    private async executeAztecGetPrivateEvents(op: AztecGetPrivateEventsOperation): Promise<PackedPrivateEvent[]> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.getPrivateEvents(network, op.eventMetadata.eventSelector, op.eventFilter);
    }

    private async executeAztecGetChainInfo(op: AztecGetChainInfoOperation): Promise<ChainInfo> {
        const network = await this.networkService.getNetwork(op.networkId);
        const node = await this.networkService.getNode(network.chainId);
        const { l1ChainId, rollupVersion } = await node.getNodeInfo();
        return { chainId: new Fr(l1ChainId), version: new Fr(rollupVersion) };
    }

    private async executeAztecRegisterSender(op: AztecRegisterSenderOperation): Promise<AztecAddress> {
        const network = await this.networkService.getNetwork(op.networkId);
        return this.pxeService.registerSender(network, op.address);
    }

    private async executeAztecGetAddressBook(op: AztecGetAddressBookOperation): Promise<Aliased<AztecAddress>[]> {
        // TODO: filter by chainId
        return (await this.contactService.getContacts()).map(x => ({
            alias: x.name,
            item: AztecAddress.fromString(x.address),
        }));
    }

    private async executeAztecRegisterContract(
        op: AztecRegisterContractOperation,
    ): Promise<ContractInstanceWithAddress> {
        const instance = await ContractInstanceWithAddressSchema.parseAsync(op.instance);
        const network = await this.networkService.getNetwork(op.networkId);

        const addressNum = instance.address.toBigInt();
        if (addressNum >= 0 && addressNum <= 6) {
            return instance;
        }

        let providedArtifact: ContractArtifact | undefined;
        try {
            providedArtifact = await ContractArtifactSchema.optional().parseAsync(op.artifact);
        } catch {
            // artifact parse failed — will fall back to lookup below
        }
        const artifact =
            providedArtifact ??
            (await this.pxeService.getContractArtifact(network, instance.currentContractClassId));
        if (!artifact) {
            throw new Error(`Contract artifact not found for class ${instance.currentContractClassId}`);
        }

        const contractClass = await getContractClassFromArtifact(artifact);
        if (contractClass.id.toString() !== instance.currentContractClassId.toString()) {
            throw new Error("Contract artifact doesn't match instance's current class id");
        }

        await this.pxeService.registerContract(network, { instance, artifact });

        if (op.secretKey) {
            await this.pxeService.registerAccount(network, op.secretKey, await computePartialAddress(instance));
        }

        return instance;
    }

    private async executeAztecSimulateTx(op: AztecSimulateTxOperation): Promise<TxSimulationResult> {
        if (op.accountAddress !== op.opts?.from?.toString()) {
            throw new Error("Invalid `opts.from`");
        }

        const [actions, feePaymentMethod, fee] = await this.processAztecJsPayload(op.exec, op.opts);
        const [txRequest, node, pxe, account] = await this.buildTxRequest({ ...op, actions }, feePaymentMethod);
        this.suggestGasLimits(txRequest, fee);
        // Embedded FPC payments: the dApp's FPC has a budgeted `amount` that must cover
        // max_gas_cost (gasLimits * maxFeesPerGas). The default maxFeesPerGas=10^18 makes
        // max_gas_cost astronomical and fails the FPC assertion. Apply dApp fees or node base fees.
        if (fee.embeddedFeePayment) {
            const maxFeesPerGas = fee.maxFeesPerGas
                ? new GasFees(BigInt(fee.maxFeesPerGas.feePerDaGas), BigInt(fee.maxFeesPerGas.feePerL2Gas))
                : await node.getCurrentMinFees();
            txRequest.txContext.gasSettings = new GasSettings(
                txRequest.txContext.gasSettings.gasLimits,
                txRequest.txContext.gasSettings.teardownGasLimits,
                maxFeesPerGas,
                txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
            );
        }
        return pxe.simulateTx(txRequest, {
            simulatePublic: true,
            skipTxValidation: op.opts.skipTxValidation,
            skipFeeEnforcement: op.opts.skipFeeEnforcement ?? true,
            scopes: [account.address],
        });
    }

    private async executeAztecSimulateUtility(op: AztecSimulateUtilityOperation): Promise<UtilitySimulationResult> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(profile.id, network.chainId, op.accountAddress);
        const pxe = this.pxeService.getPXE(network);
        await account.ensureRegistered(pxe);
        return pxe.simulateUtility(op.call, {
            authwits: await z.array(AuthWitness.schema).optional().parseAsync(op.opts.authWitnesses),
            scopes: [await AztecAddress.schema.parseAsync(op.opts.scope)],
        });
    }

    private async executeAztecProfileTx(op: AztecProfileTxOperation): Promise<TxProfileResult> {
        if (op.accountAddress !== op.opts?.from?.toString()) {
            throw new Error("Invalid `opts.from`");
        }
        const [actions, feePaymentMethod, fee] = await this.processAztecJsPayload(op.exec, op.opts);
        const [txRequest, node, pxe] = await this.buildTxRequest({ ...op, actions }, feePaymentMethod);
        this.suggestGasLimits(txRequest, fee);
        if (fee.embeddedFeePayment) {
            const maxFeesPerGas = fee.maxFeesPerGas
                ? new GasFees(BigInt(fee.maxFeesPerGas.feePerDaGas), BigInt(fee.maxFeesPerGas.feePerL2Gas))
                : await node.getCurrentMinFees();
            txRequest.txContext.gasSettings = new GasSettings(
                txRequest.txContext.gasSettings.gasLimits,
                txRequest.txContext.gasSettings.teardownGasLimits,
                maxFeesPerGas,
                txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
            );
        }
        return pxe.profileTx(txRequest, {
            profileMode: op.opts.profileMode,
            skipProofGeneration: op.opts.skipProofGeneration,
            scopes: [AztecAddress.fromString(op.accountAddress)],
        });
    }

    private async executeAztecSendTx(
        op: AztecSendTxOperation,
        origin: LocalTxOrigin,
        parentTask?: WrappedTask,
    ): Promise<SendReturn<InteractionWaitOptions>> {
        if (op.accountAddress !== op.opts?.from?.toString()) {
            throw new Error("Invalid `opts.from`");
        }

        const [actions, _, fee] = await this.processAztecJsPayload(op.exec, op.opts);

        // Attempt single-pass auth witness discovery via offchain effects.
        // Falls back to retry loop for contracts using inline verify_private_authwit.
        try {
            const authWitActions = await this.discoverRequiredAuthWitnesses({ ...op, actions: [...actions] });
            if (authWitActions.length) {
                this.logDebug(`[executeAztecSendTx] Discovered ${authWitActions.length} auth witness(es) via offchain effects`);
                actions.push(...authWitActions);
            }
        } catch (discoveryError) {
            const hash = this.extractAuthWitHash(discoveryError);
            if (hash) {
                this.logDebug(`[executeAztecSendTx] Discovery hit inline auth wit check, extracted hash ${hash}`);
                actions.push({
                    kind: "add_private_authwit",
                    content: { kind: "message_hash", messageHash: hash },
                } as AddPrivateAuthwitAction);
            }
        }

        // TODO: Remove retry loop once Aztec contracts emit auth witness requests
        // via offchain effects instead of inline verify_private_authwit. At that point
        // discoverRequiredAuthWitnesses will find all needed witnesses in one pass.
        const MAX_AUTH_WIT_RETRIES = 5;
        let lastError: unknown;
        for (let attempt = 0; attempt <= MAX_AUTH_WIT_RETRIES; attempt++) {
            try {
                const [txRequest, node, pxe, account, network, nonce, txCalls, feePaymentMethod] =
                    await this.buildAndEstimateTxRequest(
                        { ...op, actions, fee },
                        op.feeSettings,
                        parentTask,
                    );

                const provedTx = await this.proveTxTask(pxe, txRequest, [account.address], parentTask);
                const tx = await provedTx.toTx();
                await this.sendTxTask(node, tx, parentTask);

                const txHash = tx.getTxHash();
                await this.transactionService.addTransaction(
                    origin,
                    network.chainId,
                    account.address.toString(),
                    txCalls,
                    nonce.toString(),
                    feePaymentMethod,
                    txHash.toString(),
                    getEstimatedFee(txRequest),
                    getGasDetails(txRequest),
                );

                if (op.opts.wait === "NO_WAIT") {
                    return txHash;
                }
                return node.getTxReceipt(txHash);
            } catch (error) {
                lastError = error;
                const missingHash = this.extractAuthWitHash(error);
                if (!missingHash || attempt === MAX_AUTH_WIT_RETRIES) {
                    throw error;
                }
                this.logDebug(`[executeAztecSendTx] Missing auth witness for ${missingHash}, creating (attempt ${attempt + 1})`);
                actions.push({
                    kind: "add_private_authwit",
                    content: { kind: "message_hash", messageHash: missingHash },
                } as AddPrivateAuthwitAction);
            }
        }
        throw lastError;
    }

    private extractAuthWitHash(error: unknown): string | null {
        const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
        const match = message.match(
            /Unknown auth witness for message hash (0x[0-9a-fA-F]+)/,
        );
        return match?.[1] ?? null;
    }

    /**
     * Discover auth witnesses needed by a transaction via offchain effects.
     * Runs a single simulation with skipTxValidation to collect CallAuthorizationRequest
     * effects without failing on missing witnesses.
     */
    private async discoverRequiredAuthWitnesses(
        op: { networkId: string; accountAddress: string; actions: Action[] },
    ): Promise<AddPrivateAuthwitAction[]> {
        const [txRequest, node, pxe, account] = await this.buildTxRequest(
            op,
            AzguardFeePaymentMethod.FeeJuice,
        );

        const simulationResult = await pxe.simulateTx(txRequest, {
            simulatePublic: true,
            skipTxValidation: true,
            skipFeeEnforcement: true,
            scopes: [account.address],
        });

        const effects = collectOffchainEffects(simulationResult.privateExecutionResult);
        if (!effects.length) {
            return [];
        }

        const nodeInfo = await node.getNodeInfo();
        const chainInfo = { chainId: new Fr(nodeInfo.l1ChainId), version: new Fr(nodeInfo.rollupVersion) };
        const actions: AddPrivateAuthwitAction[] = [];

        for (const effect of effects) {
            try {
                const authRequest = await CallAuthorizationRequest.fromFields(effect.data);
                const messageHash = await computeAuthWitMessageHash(
                    { consumer: effect.contractAddress, innerHash: authRequest.innerHash as IntentInnerHash },
                    chainInfo,
                );
                actions.push({
                    kind: "add_private_authwit",
                    content: { kind: "message_hash", messageHash: messageHash.toString() },
                });
            } catch {
                // Not a CallAuthorizationRequest — other offchain effect type, skip
            }
        }

        return actions;
    }

    public async executeAztecCreateAuthWit(op: AztecCreateAuthWitOperation): Promise<AuthWitness> {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Wallet locked");
        }
        const network = await this.networkService.getNetwork(op.networkId);
        const account = await this.accountService.getAccountContract(
            profile.id,
            network.chainId,
            op.accountAddress.toString(),
        );

        const node = await this.networkService.getNode(network.chainId);
        const nodeInfo = await node.getNodeInfo();
        const metadata = {
            chainId: new Fr(nodeInfo.l1ChainId),
            version: new Fr(nodeInfo.rollupVersion),
        };

        let messageHash: Fr;
        if (typeof op.messageHashOrIntent === "object" && "caller" in op.messageHashOrIntent) {
            const { caller, call } = op.messageHashOrIntent;
            const intentAction: CallIntent = {
                caller: await AztecAddress.schema.parseAsync(caller),
                call: new FunctionCall(
                    call.name,
                    await AztecAddress.schema.parseAsync(call.to),
                    await FunctionSelector.schema.parseAsync(call.selector),
                    call.type,
                    call.hideMsgSender,
                    call.isStatic,
                    await z.array(Fr.schema).parseAsync(call.args),
                    await z.array(AbiTypeSchema).parseAsync(call.returnTypes),
                ),
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
            // Raw Fr message hash (pre-computed by wallet-sdk)
            messageHash = await Fr.schema.parseAsync(op.messageHashOrIntent);
        }

        const authWitness = await account.buildAuthWitness(messageHash);
        return authWitness;
    }

    // internals

    private async processAztecJsPayload(
        exec: ExecutionPayload,
        opts: SimulateOptions | ProfileOptions | SendOptions<InteractionWaitOptions>,
    ): Promise<[Action[], AzguardFeePaymentMethod, FeeOptions]> {
        const actions: Action[] = [];

        for (const _capsule of (exec.capsules ?? []).concat(opts.capsules ?? [])) {
            const capsule = await Capsule.schema.parseAsync(_capsule);
            actions.push({
                kind: "add_capsule",
                contract: capsule.contractAddress.toString(),
                storageSlot: capsule.storageSlot.toString(),
                capsule: capsule.data.map(x => x.toString()),
            } satisfies AddCapsuleAction);
        }

        for (const _authwit of (exec.authWitnesses ?? []).concat(opts.authWitnesses ?? [])) {
            const authwit = await AuthWitness.schema.parseAsync(_authwit);
            actions.push({
                kind: "add_private_authwit",
                content: {
                    kind: "message_hash",
                    messageHash: authwit.requestHash.toString(),
                },
                authwit: authwit.witness.map(x => x.toString()),
            } satisfies AddPrivateAuthwitAction);
        }

        for (const _args of exec.extraHashedArgs ?? []) {
            const args = await HashedValues.schema.parseAsync(_args);
            actions.push({
                kind: "add_extra_args",
                args: args.values.map(x => x.toString()),
            } satisfies AddExtraArgsAction);
        }

        for (const _call of exec.calls ?? []) {
            const call = await FunctionCall.schema.parseAsync(_call);
            actions.push({
                kind: "encoded_call",
                to: call.to.toString(),
                selector: call.selector.toString(),
                args: call.args.map(x => x.toString()),
                hideMsgSender: call.hideMsgSender,
                name: call.name,
                type: call.type,
                isStatic: call.isStatic,
                returnTypes: call.returnTypes,
            } satisfies EncodedCallAction);
        }

        const feeOptions: FeeOptions = {
            embeddedFeePayment: !exec.feePayer
                ? undefined
                : exec.feePayer.toString() === opts.from.toString()
                ? "fjwc"
                : "fpc",
            gasLimits: opts.fee?.gasSettings?.gasLimits,
            teardownGasLimits: opts.fee?.gasSettings?.teardownGasLimits,
            maxFeesPerGas: opts.fee?.gasSettings?.maxFeesPerGas,
            gasPadding: 1,
        };

        const feePaymentMethod =
            feeOptions.embeddedFeePayment === "fjwc"
                ? AzguardFeePaymentMethod.FeeJuiceWithClaim
                : feeOptions.embeddedFeePayment === "fpc"
                ? AzguardFeePaymentMethod.External
                : AzguardFeePaymentMethod.FeeJuice;

        return [actions, feePaymentMethod, feeOptions];
    }

    private suggestGasLimits(txRequest: TxExecutionRequest, options?: FeeOptions) {
        if (options?.gasLimits && options.teardownGasLimits) {
            txRequest.txContext.gasSettings = new GasSettings(
                new Gas(options.gasLimits.daGas, options.gasLimits.l2Gas),
                new Gas(options.teardownGasLimits.daGas, options.teardownGasLimits.l2Gas),
                txRequest.txContext.gasSettings.maxFeesPerGas,
                txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
            );
        } else if (options?.gasLimits) {
            txRequest.txContext.gasSettings = new GasSettings(
                new Gas(options.gasLimits.daGas, options.gasLimits.l2Gas),
                txRequest.txContext.gasSettings.teardownGasLimits,
                txRequest.txContext.gasSettings.maxFeesPerGas,
                txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
            );
        } else if (options?.teardownGasLimits) {
            txRequest.txContext.gasSettings = new GasSettings(
                txRequest.txContext.gasSettings.gasLimits,
                new Gas(options.teardownGasLimits.daGas, options.teardownGasLimits.l2Gas),
                txRequest.txContext.gasSettings.maxFeesPerGas,
                txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
            );
        }
    }

    private async finalizeGasLimits(
        node: AztecNode,
        txRequest: TxExecutionRequest,
        simulatedTx: TxSimulationResult,
        gasPadding: number,
        maxFeesPerGas?: GasFees,
        customLimits?: FeeOptions,
        feeMultiplier?: number,
    ) {
        const multiplier = feeMultiplier ?? DEFAULT_FEE_MULTIPLIER;
        if (!maxFeesPerGas) {
            if (customLimits?.maxFeesPerGas) {
                maxFeesPerGas = new GasFees(
                    BigInt(customLimits.maxFeesPerGas.feePerDaGas),
                    BigInt(customLimits.maxFeesPerGas.feePerL2Gas),
                );
            } else {
                maxFeesPerGas = await node.getCurrentMinFees()
                maxFeesPerGas = maxFeesPerGas.mul(multiplier);
            }
        }

        const gasLimits = customLimits?.gasLimits
            ? new Gas(customLimits.gasLimits.daGas, customLimits.gasLimits.l2Gas)
            : simulatedTx.gasUsed.totalGas.mul(gasPadding);

        const teardownGasLimits = customLimits?.teardownGasLimits
            ? new Gas(customLimits.teardownGasLimits.daGas, customLimits.teardownGasLimits.l2Gas)
            : simulatedTx.gasUsed.teardownGas.mul(gasPadding);

        txRequest.txContext.gasSettings = new GasSettings(
            gasLimits,
            teardownGasLimits,
            maxFeesPerGas,
            txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
        );
    }

    private async buildAndEstimateTxRequest(
        op: {
            networkId: string;
            accountAddress: string;
            actions: Action[];
            fee?: FeeOptions;
        },
        feeSettings: FeeSettings,
        parentTask?: WrappedTask,
    ): Promise<
        [TxExecutionRequest, AztecNode, IPXE, IAccountContract, Network, Fr, TxCall[], AzguardFeePaymentMethod]
    > {
        const step = new StepContent("Estimating fee");
        const task = parentTask ? parentTask.startSubtask(step) : this.taskService.startNewTask(step);
        const feePaymentMethod = feeSettings.paymentMethod;
        const feeMultiplier = feeSettings.priorityLevel
            ? PRIORITY_MULTIPLIERS[feeSettings.priorityLevel]
            : undefined;

        try {
            const gasPadding = op.fee?.gasPadding ?? 1.05;
            switch (feePaymentMethod.kind) {
                case "fj": {
                    const [txRequest, node, pxe, account, network, nonce, txCalls] = await this.buildTxRequest(
                        op,
                        AzguardFeePaymentMethod.FeeJuice,
                        task,
                    );
                    this.suggestGasLimits(txRequest, op.fee);
                    const simulatedTx = await this.simulateTxTask(
                        pxe,
                        txRequest,
                        { simulatePublic: true, skipFeeEnforcement: true, scopes: [account.address] },
                        task,
                    );
                    await this.finalizeGasLimits(node, txRequest, simulatedTx, gasPadding, undefined, op.fee, feeMultiplier);
                    task.complete();
                    return [txRequest, node, pxe, account, network, nonce, txCalls, AzguardFeePaymentMethod.FeeJuice];
                }
                case "fjwc": {
                    const { claimAmount, claimSecret, messageLeafIndex } = feePaymentMethod;
                    op.actions.unshift(
                        ...getFeeJuiceClaimPayload(op.accountAddress, claimAmount, claimSecret, messageLeafIndex),
                    );
                    let [txRequest, node, pxe, account, network, nonce, txCalls] = await this.buildTxRequest(
                        op,
                        AzguardFeePaymentMethod.FeeJuiceWithClaim,
                        task,
                    );
                    this.suggestGasLimits(txRequest, op.fee);
                    const simulatedTx = await this.simulateTxTask(
                        pxe,
                        txRequest,
                        { simulatePublic: true, skipFeeEnforcement: true, scopes: [account.address] },
                        task,
                    );
                    await this.finalizeGasLimits(node, txRequest, simulatedTx, gasPadding, undefined, op.fee, feeMultiplier);
                    task.complete();
                    return [
                        txRequest,
                        node,
                        pxe,
                        account,
                        network,
                        nonce,
                        txCalls,
                        AzguardFeePaymentMethod.FeeJuiceWithClaim,
                    ];
                }
                case "fpc": {
                    const { fpcId, inPublic } = feePaymentMethod;
                    const fpc = await this.fpcService.getFpcImpl(fpcId);
                    const originalActions = [...op.actions];
                    const multiplier = feeMultiplier ?? DEFAULT_FEE_MULTIPLIER;
                    // first approach
                    let [txRequest, node, pxe, account, network, nonce, txCalls] = await this.buildTxRequest(
                        op,
                        AzguardFeePaymentMethod.FeeJuice,
                        task,
                    );
                    this.suggestGasLimits(txRequest, op.fee);
                    let simulatedTx = await this.simulateTxTask(
                        pxe,
                        txRequest,
                        { simulatePublic: true, skipFeeEnforcement: true, scopes: [account.address] },
                        task,
                    );
                    // Fetch actual fees for FPC fee payload (with priority multiplier)
                    const baseFees = (await node.getCurrentMinFees()).mul(multiplier);
                    let maxFee = simulatedTx.gasUsed.totalGas
                        .add(fpc.getTotalGas(inPublic))
                        .computeFee(baseFees);
                    op.actions.unshift(...fpc.getFeePayload(op.accountAddress, maxFee, inPublic));
                    // precise estimation
                    [txRequest, node, pxe, account, network, nonce, txCalls] = await this.buildTxRequest(
                        op,
                        AzguardFeePaymentMethod.External,
                        task,
                    );
                    txRequest.txContext.gasSettings = new GasSettings(
                        simulatedTx.gasUsed.totalGas.add(fpc.getTotalGas(inPublic)),
                        simulatedTx.gasUsed.teardownGas.add(fpc.getTeardownGas(inPublic)),
                        baseFees,
                        txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                    );
                    simulatedTx = await this.simulateTxTask(
                        pxe,
                        txRequest,
                        { simulatePublic: true, skipFeeEnforcement: true, scopes: [account.address] },
                        task,
                    );
                    maxFee = simulatedTx.gasUsed.totalGas
                        .mul(gasPadding)
                        .computeFee(baseFees);
                    op.actions.splice(
                        0,
                        op.actions.length,
                        ...fpc.getFeePayload(op.accountAddress, maxFee, inPublic),
                        ...originalActions,
                    );
                    await this.finalizeGasLimits(node, txRequest, simulatedTx, gasPadding, baseFees);
                    task.complete();
                    return [txRequest, node, pxe, account, network, nonce, txCalls, AzguardFeePaymentMethod.External];
                }
                case "embedded": {
                    if (!op.fee?.embeddedFeePayment) {
                        throw new Error("Embedded fee payment not specified");
                    }
                    const embeddedMethod =
                        op.fee.embeddedFeePayment === "fjwc"
                            ? AzguardFeePaymentMethod.FeeJuiceWithClaim
                            : AzguardFeePaymentMethod.External;
                    let [txRequest, node, pxe, account, network, nonce, txCalls] = await this.buildTxRequest(
                        op,
                        embeddedMethod,
                        task,
                    );
                    // Embedded payments: the dApp's FPC has a budgeted `amount` that must cover
                    // max_gas_cost (gasLimits * maxFeesPerGas). The default initial gas settings
                    // use maxFeesPerGas=10^18 which makes max_gas_cost astronomical and fails
                    // the FPC assertion. Override with realistic fees before simulation.
                    this.suggestGasLimits(txRequest, op.fee);
                    {
                        const maxFeesPerGas = op.fee?.maxFeesPerGas
                            ? new GasFees(BigInt(op.fee.maxFeesPerGas.feePerDaGas), BigInt(op.fee.maxFeesPerGas.feePerL2Gas))
                            : await node.getCurrentMinFees();
                        txRequest.txContext.gasSettings = new GasSettings(
                            txRequest.txContext.gasSettings.gasLimits,
                            txRequest.txContext.gasSettings.teardownGasLimits,
                            maxFeesPerGas,
                            txRequest.txContext.gasSettings.maxPriorityFeesPerGas,
                        );
                    }
                    const simulatedTx = await this.simulateTxTask(
                        pxe,
                        txRequest,
                        { simulatePublic: true, skipFeeEnforcement: true, scopes: [account.address] },
                        task,
                    );
                    // Use 1x multiplier so max_gas_cost stays within the dApp's embedded amount.
                    await this.finalizeGasLimits(node, txRequest, simulatedTx, gasPadding, undefined, op.fee, 1);
                    task.complete();
                    return [txRequest, node, pxe, account, network, nonce, txCalls, embeddedMethod];
                }
                default: {
                    throw new Error("Invalid fee payment method");
                }
            }
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async buildTxRequest(
        op: {
            networkId: string;
            accountAddress: string;
            actions: Action[];
        },
        feePaymentMethod: AzguardFeePaymentMethod,
        parentTask?: WrappedTask,
    ): Promise<[TxExecutionRequest, AztecNode, IPXE, IAccountContract, Network, Fr, TxCall[]]> {
        const step = new StepContent("Processing transaction");
        const task = parentTask ? parentTask.startSubtask(step) : this.taskService.startNewTask(step);

        try {
            const profile = await this.profileService.getActiveProfile();
            if (!profile) {
                throw new Error("Wallet locked");
            }
            const network = await this.networkService.getNetwork(op.networkId);
            const account = await this.accountService.getAccountContract(
                profile.id,
                network.chainId,
                op.accountAddress,
            );
            const node = await this.networkService.getNode(network.chainId);
            const pxe = this.pxeService.getPXE(network);

            const nodeInfo = await node.getNodeInfo();
            const contracts = this.getContracts(op.actions);
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
            const nonce = Fr.random();
            const txCalls: TxCall[] = [];

            for (const action of op.actions) {
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
                    case "add_extra_args": {
                        this.logDebug("Adding extra args...");
                        args.push(await HashedValues.fromArgs(action.args.map(x => Fr.fromString(x))));
                        this.logDebug("Extra args added.");
                        break;
                    }
                    case "add_private_authwit": {
                        this.logDebug("Adding private authwit...");

                        let messageHash: Fr;
                        switch (action.content.kind) {
                            case "call": {
                                messageHash = await this.getCallMessageHash(
                                    action.content,
                                    nodeInfo,
                                    instances,
                                    artifacts,
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
                                messageHash = await this.getCallMessageHash(
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
                                false,
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
                                action.hideSender === true,
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
                                    const selector = await FunctionSelector.fromNameAndParameters(
                                        _fn.name,
                                        _fn.parameters,
                                    );
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
                                action.hideMsgSender === true,
                            ),
                        );
                        txCalls.push({ contract: action.to, method: action.name || action.selector, args: action.args });
                        this.logDebug("EncodedCall enqueued.");
                        break;
                    }
                }
            }

            const txRequest = await account.buildTxExecutionRequest(
                node,
                pxe,
                calls,
                nonce,
                feePaymentMethod,
                args,
                authwits,
                capsules,
            );

            task.complete();
            return [txRequest, node, pxe, account, network, nonce, txCalls];
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async simulateTxTask(
        pxe: IPXE,
        txRequest: TxExecutionRequest,
        opts: SimulateTxOpts,
        parentTask?: WrappedTask,
    ) {
        const step = new StepContent("Simulating transaction");
        const task = parentTask ? parentTask.startSubtask(step) : this.taskService.startNewTask(step);
        try {
            const simulatedTx = await pxe.simulateTx(txRequest, opts);
            task.complete();
            return simulatedTx;
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async proveTxTask(pxe: IPXE, txRequest: TxExecutionRequest, scopes: AztecAddress[], parentTask?: WrappedTask) {
        const step = new StepContent("Generating proof");
        const task = parentTask ? parentTask.startSubtask(step) : this.taskService.startNewTask(step);
        try {
            const provedTx = await pxe.proveTx(txRequest, scopes);
            task.complete();
            return provedTx;
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async sendTxTask(node: AztecNode, tx: Tx, parentTask?: WrappedTask): Promise<void> {
        const step = new StepContent("Sending transaction");
        const task = parentTask ? parentTask.startSubtask(step) : this.taskService.startNewTask(step);
        try {
            await node.sendTx(tx);
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
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
                call: new FunctionCall(
                    fn.name,
                    AztecAddress.fromString(content.contract),
                    await FunctionSelector.fromNameAndParameters(fn.name, fn.parameters),
                    fn.functionType,
                    content.hideSender === true,
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
                call: new FunctionCall(
                    content.name,
                    AztecAddress.fromString(content.to),
                    FunctionSelector.fromString(content.selector),
                    content.type as FunctionType,
                    content.hideMsgSender === true,
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

    private async getInstances(pxe: IPXE, contracts: string[]): Promise<Map<string, ContractInstanceWithAddress>> {
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

    private async getInstance(pxe: IPXE, contract: string): Promise<[string, ContractInstanceWithAddress]> {
        const instance = await pxe.getContractInstance(AztecAddress.fromString(contract));
        if (!instance) {
            throw new Error("Contract instance not found");
        }
        return [contract, instance];
    }

    private async getArtifacts(
        pxe: IPXE,
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
        this.logDebug(`Fetching ${classIds.size} artifacts for contracts: ${[...instances.keys()].join(", ")}...`);
        this.logDebug(`Class IDs: ${[...classIds].join(", ")}`);
        const fetched = await Promise.all(classIds.values().map(x => this.getArtifact(pxe, x)));
        this.logDebug(`${fetched.length} artifacts fetched`);
        for (const [classId, artifact] of fetched) {
            artifacts.set(classId, artifact);
        }
        return artifacts;
    }

    private async getArtifact(pxe: IPXE, classId: string): Promise<[string, ContractArtifact]> {
        const artifact = await pxe.getContractArtifact(Fr.fromString(classId));
        if (!artifact) {
            throw new Error(`Contract artifact not found for class ${classId}`);
        }
        return [classId, artifact];
    }
}
