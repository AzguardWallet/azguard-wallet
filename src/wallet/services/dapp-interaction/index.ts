import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import type { ProfileService } from "@/wallet/services/profile";
import type { NetworkService } from "@/wallet/services/network";
import type { Network } from "@/wallet/services/network/client";
import type { AccountService } from "@/wallet/services/account";
import type { Account } from "@/wallet/services/account/client";
import type { DappSessionService } from "@/wallet/services/dapp-session";
import { AccessLevel, type DappSession } from "@/wallet/services/dapp-session/client";
import type { ExecutionService } from "@/wallet/services/execution";
import { type ILogs } from "@/wallet/services/logger/client";
import {
    type IOperation,
    FeeSettings,
    CustomPaymentMethod,
    GetCompleteAddressOperation as ExecGetCompleteAddressOperation,
    RegisterContractOperation as ExecRegisterContractOperation,
    RegisterSenderOperation as ExecRegisterSenderOperation,
    RegisterTokenOperation as ExecRegisterTokenOperation,
    SimulateTransactionOperation as ExecSimulateTransactionOperation,
    SimulateUtilityOperation as ExecSimulateUtilityOperation,
    SimulateViewsOperation as ExecSimulateViewsOperation,
    SendTransactionOperation as ExecSendTransactionOperation,
} from "@/wallet/services/execution/client";
import { OriginType, TxOrigin } from "@/wallet/services/transaction/client";
import { getRandomHex, Lock } from "@/wallet/utils";
import {
    DAPP_INTERACTION_SERVICE_NAME, 
    type GetInteractionPayloadRequest,
    type ResolveInteractionRequest,
    type RejectInteractionRequest,
    GetInteractionPayloadResponse,
    ResolveInteractionResponse,
    RejectInteractionResponse,
    DappInteractionServiceEvent,
    DappInteractionServiceEventMessage,
    DappInteractionServiceMethod,
    type ConnectionPayload,
    type ConnectionResult,  
    type ExecutionPayload,
    type ExecutionResult,
} from "./client";
import {
    type ConnectionParams,
    type ExecutionParams,
    OperationKind,
    type GetCompleteAddressOperation,
    type RegisterContractOperation,
    type RegisterSenderOperation,
    type RegisterTokenOperation,
    type SendTransactionOperation,
    type SimulateTransactionOperation,
    type SimulateUtilityOperation,
    type SimulateViewsOperation,
    type CaipChain,
    type CaipAccount,
    type OperationResult,
    type Operation,
} from "./types";

type DappInteraction = {
    id: string,
    payload: ConnectionPayload | ExecutionPayload,
    resolve: (result: ConnectionResult | ExecutionResult) => void,
    reject: (reason: string) => void,
    cancellationToken: string,
};

export class DappInteractionService extends Service {
    private readonly storage: Map<string, DappInteraction> = new Map();
    private readonly lock = new Lock();

    public constructor(
        private readonly profileService: ProfileService,
        private readonly networkService: NetworkService,
        private readonly accountService: AccountService,
        private readonly dappSessions: DappSessionService,
        private readonly executionService: ExecutionService,
        public readonly logger: ILogs,
        emit: (event: EventMessage) => void
    ) {        
        super(DAPP_INTERACTION_SERVICE_NAME, logger, emit);
    }
    
    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch(request.method) {
            case DappInteractionServiceMethod.GetInteractionPayload: {
                const _request = request as GetInteractionPayloadRequest;
                try {
                    return new GetInteractionPayloadResponse(_request, this.getInteractionPayload(_request.interactionId));
                }
                catch (error: unknown) {
                    return new GetInteractionPayloadResponse(_request, undefined, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappInteractionServiceMethod.ResolveInteraction: {
                const _request = request as ResolveInteractionRequest;
                try {
                    this.resolveInteraction(_request.interactionId, _request.result);
                    return new ResolveInteractionResponse(_request);
                }
                catch (error: unknown) {
                    return new ResolveInteractionResponse(_request, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            case DappInteractionServiceMethod.RejectInteraction: {
                const _request = request as RejectInteractionRequest;
                try {
                    this.rejectInteraction(_request.interactionId, _request.reason);
                    return new RejectInteractionResponse(_request);
                }
                catch (error: unknown) {
                    return new RejectInteractionResponse(_request, (error as Error)?.message ?? error as string ?? "Unknown error");
                }
            }
            default: {
                this.logError(`Invalid request method ${request.method}.`)
                return undefined;
            }
        }
    }

    private getInteractionPayload(id: string): ConnectionPayload | ExecutionPayload {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        return interactionRequest.payload;
    }
    
    private resolveInteraction(id: string, result: ConnectionResult | ExecutionResult) {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.resolve(result);
    }

    private rejectInteraction(id: string, reason: string) {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.reject(reason);
    }

    public cancelInteraction(cancellationToken: string) {
        const interaction = this.storage.values().find(x => x.cancellationToken === cancellationToken);
        if (interaction) {
            this.emit(new DappInteractionServiceEventMessage(DappInteractionServiceEvent.InteractionCancelled, interaction.id));
        }
    }

    public async connect(params: ConnectionParams, cancellationToken?: string): Promise<ConnectionResult> {
        const payload: ConnectionPayload = {params}; 
        return await this.interaction("connect", payload, cancellationToken) as ConnectionResult;
    }

    public async execute(params: ExecutionParams, cancellationToken?: string): Promise<ExecutionResult> {
        const session = await this.validateSession(params);
        const payload: ExecutionPayload = {params, session};
        if (!await this.isConfirmationNeeded(payload)) {
            return await this.silentInteraction(payload);
        }
        return await this.interaction("execute", payload, cancellationToken) as ExecutionResult;
    }

    private async interaction(
        type: string,
        payload: ConnectionPayload | ExecutionPayload,
        cancellationToken?: string,
    ): Promise<ConnectionResult | ExecutionResult> {
        let interaction: DappInteraction;
        let promise: Promise<ConnectionResult | ExecutionResult>;

        try {
            await this.lock.enter();

            let id: string;
            do { id = getRandomHex(8); }
            while (this.storage.has(id));

            interaction = {
                id,
                payload,
                resolve: null!,
                reject: null!,
                cancellationToken: cancellationToken ?? id,
            };

            promise = new Promise<ConnectionResult | ExecutionResult>((resolve, reject) => {
                interaction.resolve = resolve;
                interaction.reject = reject;
            });

            this.storage.set(id, interaction);
        }
        finally {
            this.lock.leave();
        }

        chrome.windows.create({
            type: 'popup',
            url: chrome.runtime.getURL(`src/popup/index.html#/windows/${type}?requestId=${interaction.id}`),
            height: 800,
            width: 400
        });

        return promise;
    }

    private async silentInteraction(payload: ExecutionPayload): Promise<ExecutionResult> {
        const profile = await this.profileService.getActiveProfile();
        if (profile?.id !== payload.session.profileId) {
            throw new Error("Wallet locked");
        }
        const getNetwork = async (caipChain: CaipChain): Promise<Network> => {
            const [_, chainId] = caipChain.split(":");
            const networks = await this.networkService.getNetworks(+chainId);
            if (networks.length === 0) {
                throw new Error("Network no longer exists");
            }
            return networks.find(x => x.isDefault) ?? networks[0];
        }
        const getNetworkAndAccount = async (caipAccount: CaipAccount): Promise<[Network, Account]> => {
            const [_, chainId, address] = caipAccount.split(":");
            const networks = await this.networkService.getNetworks(+chainId);
            if (networks.length === 0) {
                throw new Error("Network no longer exists");
            }
            const network = networks.find(x => x.isDefault) ?? networks[0];
            const account = await this.accountService.getAccount(profile.id, network.chainId, address);
            if (!account) {
                throw new Error("Account no longer exists");
            }
            return [network, account];
        }
		const operations: IOperation[] = [];
		for (const op of payload.params.operations) {
			switch (op.kind) {
				case OperationKind.RegisterContract:{
					const network = await getNetwork(op.chain);
                    operations.push(new ExecRegisterContractOperation(
                        network.id,
                        op.address,
                        op.instance,
                        op.artifact,
                    ));
                    break;
                }
				case OperationKind.RegisterSender: {
					const network = await getNetwork(op.chain);
                    operations.push(new ExecRegisterSenderOperation(
                        network.id,
                        op.address,
                    ));
					break;
				}
				case OperationKind.RegisterToken: {
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecRegisterTokenOperation(
                        network.id,
                        account.address,
                        op.address,
                    ));
					break;
				}
				case OperationKind.GetCompleteAddress:{
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecGetCompleteAddressOperation(
                        network.id,
                        account.address,
                    ));
					break;
				}
				case OperationKind.SendTransaction: {
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecSendTransactionOperation(
                        network.id,
                        account.address,
                        new FeeSettings(new CustomPaymentMethod()),
                        op.actions,
                        op.setup,
                    ));
					break;
				}
				case OperationKind.SimulateTransaction: {
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecSimulateTransactionOperation(
                        network.id,
                        account.address,
                        op.actions,
                        op.setup,
                        op.simulatePublic,
                    ));
					break;
				}
				case OperationKind.SimulateUtility: {
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecSimulateUtilityOperation(
                        network.id,
                        account.address,
                        op.contract,
                        op.method,
                        op.args,
                    ));
					break;
				}
				case OperationKind.SimulateViews: {
					const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecSimulateViewsOperation(
                        network.id,
                        account.address,
                        op.calls,
                    ));
					break;
				}
				default: {
					throw new Error("Invalid operation kind");
				}
			}
		}
        await this.profileService.refreshSession();
        const results = await this.executionService.executeOperations(
            operations,
            new TxOrigin(OriginType.DAPP, payload.session.dappMetadata.name ?? "Unknown dapp"),
        );
        // TODO: refactor types
        return results.map(x => x as unknown as OperationResult);
    }

    private async validateSession({sessionId, operations}: ExecutionParams): Promise<DappSession> {
        const session = await this.dappSessions.tryGetDappSession(sessionId);
        if (!session) {
            throw new Error("Invalid session");
        }
        for (const operation of operations) {
            switch (operation.kind) {
                case OperationKind.GetCompleteAddress: {
                    const _operation = operation as GetCompleteAddressOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    break;
                }
                case OperationKind.RegisterContract: {
                    const _operation = operation as RegisterContractOperation;
                    this.checkMethodPermission(session, _operation.kind, _operation.chain);
                    break;
                }
                case OperationKind.RegisterSender: {
                    const _operation = operation as RegisterSenderOperation;
                    this.checkMethodPermission(session, _operation.kind, _operation.chain);
                    break;
                }
                case OperationKind.RegisterToken: {
                    const _operation = operation as RegisterTokenOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    break;
                }
                case OperationKind.SendTransaction: {
                    const _operation = operation as SendTransactionOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    _operation.actions.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    _operation.setup?.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    break;
                }
                case OperationKind.SimulateTransaction: {
                    const _operation = operation as SimulateTransactionOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    _operation.actions.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    _operation.setup?.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    break;
                }
                case OperationKind.SimulateUtility: {
                    const _operation = operation as SimulateUtilityOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    break;
                }
                case OperationKind.SimulateViews: {
                    const _operation = operation as SimulateViewsOperation;
                    const chain = _operation.account.substring(0, _operation.account.lastIndexOf(":"));
                    this.checkAccountPermission(session, _operation.account);
                    this.checkMethodPermission(session, _operation.kind, chain);
                    _operation.calls.forEach(x => this.checkMethodPermission(session, x.kind, chain));
                    break;
                }
            }
        }
        return session;
    }
    
    private checkAccountPermission(session: DappSession, account: string) {
        if (!session.accounts.includes(account)) {
            throw new Error("Unauthorized account");
        }
    }
    
    private checkMethodPermission(session: DappSession, method: string, chain: string) {
        if (!session.permissions.find(x => x.methods?.includes(method) && x.chains?.includes(chain))) {
            throw new Error("Unauthorized method/chain");
        }
    }

    private async isConfirmationNeeded(payload: ExecutionPayload): Promise<boolean> {
        const profile = await this.profileService.getActiveProfile();
        if (profile?.id !== payload.session.profileId) {
            return true;
        }
        const accessLevel = this.getAccessLevel(payload.params.operations);
        if (accessLevel >= payload.session.confirmationLevel) {
            return true;
        }
        if (payload.params.operations.find(x => x.kind === OperationKind.SendTransaction && !x.setup?.length)) {
            return true;
        }
        return false;
    }

    private getAccessLevel(ops: Operation[]): AccessLevel {
        let level = AccessLevel.None;
        for (const op of ops) {
            level = Math.max(level, this.getOperationAccessLevel(op.kind));
        }
        return level;
    }

    private getOperationAccessLevel(kind: OperationKind): AccessLevel {
        switch (kind) {
            case OperationKind.RegisterToken: return AccessLevel.AppState;
            case OperationKind.GetCompleteAddress: return AccessLevel.PublicData;
            case OperationKind.RegisterContract: return AccessLevel.PxeState;
            case OperationKind.RegisterSender: return AccessLevel.PxeState;
            case OperationKind.SimulateTransaction: return AccessLevel.PrivateData;
            case OperationKind.SimulateUtility: return AccessLevel.PrivateData;
            case OperationKind.SimulateViews: return AccessLevel.PrivateData;
            case OperationKind.SendTransaction: return AccessLevel.Transactions;
            default: return AccessLevel.None;
        }
    }
}