import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ILogger } from "@/wallet/logger";
import { ProfileService } from "@/wallet/services/profile/service";
import { NetworkService, Network } from "@/wallet/services/network/service";
import { AccountService, Account } from "@/wallet/services/account/service";
import { DappSessionService, AccessLevel, DappSession } from "@/wallet/services/dapp-session/service";
import {
    ExecutionService,
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
} from "@/wallet/services/execution/service";
import { OriginType } from "@/wallet/services/transaction/service";
import { getRandomHex, Lock } from "@/wallet/utils";
import { EventHandler } from "@/wallet/utils/event-handler";
import {
    DAPP_INTERACTION_SERVICE_NAME,
    type ConnectionPayload,
    type ConnectionResult,
    type ExecutionPayload,
    type ExecutionResult,
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
    Methods,
    Events,
    DappSessionInfo,
    DappInteraction,
} from "./spec";

export * from "./spec";

export class DappInteractionService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = DAPP_INTERACTION_SERVICE_NAME;

    public readonly onInteractionCancelled = new EventHandler<string>();

    private readonly storage: Map<string, DappInteraction> = new Map();
    private readonly lock = new Lock();

    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private dappSessionService: DappSessionService = null!;
    private executionService: ExecutionService = null!;

    public constructor(logger: ILogger) {
        super(DAPP_INTERACTION_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.dappSessionService = services.get(DappSessionService.name);
        this.executionService = services.get(ExecutionService.name);
    }

    public async getInteractionPayload(id: string): Promise<ConnectionPayload | ExecutionPayload> {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        return interactionRequest.payload;
    }

    public async resolveInteraction(id: string, result: DappSessionInfo | ExecutionResult): Promise<void> {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.resolve(result);
    }

    public async rejectInteraction(id: string, reason: string): Promise<void> {
        const interactionRequest = this.storage.get(id);
        if (!interactionRequest) {
            throw new Error("Invalid id");
        }
        interactionRequest.reject(reason);
    }

    public cancelInteraction(cancellationToken: string) {
        const interaction = this.storage.values().find(x => x.cancellationToken === cancellationToken);
        if (interaction) {
            this.emit("onInteractionCancelled", interaction.id);
        }
    }

    public async connect(params: ConnectionParams, cancellationToken?: string): Promise<ConnectionResult> {
        const payload: ConnectionPayload = { params };
        return (await this.interaction("connect", payload, cancellationToken)) as ConnectionResult;
    }

    public async execute(params: ExecutionParams, cancellationToken?: string): Promise<ExecutionResult> {
        await this.ensureInitialized();
        const session = await this.validateSession(params);
        const payload: ExecutionPayload = { params, session };
        if (!(await this.isConfirmationNeeded(payload))) {
            return await this.silentInteraction(payload);
        }
        return (await this.interaction("execute", payload, cancellationToken)) as ExecutionResult;
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
            do {
                id = getRandomHex(8);
            } while (this.storage.has(id));

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
        } finally {
            this.lock.leave();
        }

        chrome.windows.create({
            type: "popup",
            url: chrome.runtime.getURL(`src/popup/index.html#/windows/${type}?requestId=${interaction.id}`),
            height: 800,
            width: 400,
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
        };
        const getNetworkAndAccount = async (caipAccount: CaipAccount): Promise<[Network, Account]> => {
            const [_, chainId, address] = caipAccount.split(":");
            const networks = await this.networkService.getNetworks(+chainId);
            if (networks.length === 0) {
                throw new Error("Network no longer exists");
            }
            const network = networks.find(x => x.isDefault) ?? networks[0];
            const account = await this.accountService.getAccount(profile!.id, network.chainId, address);
            if (!account) {
                throw new Error("Account no longer exists");
            }
            return [network, account];
        };
        const operations: IOperation[] = [];
        for (const op of payload.params.operations) {
            switch (op.kind) {
                case OperationKind.RegisterContract: {
                    const network = await getNetwork(op.chain);
                    operations.push(
                        new ExecRegisterContractOperation(network.id, op.address, op.instance, op.artifact),
                    );
                    break;
                }
                case OperationKind.RegisterSender: {
                    const network = await getNetwork(op.chain);
                    operations.push(new ExecRegisterSenderOperation(network.id, op.address));
                    break;
                }
                case OperationKind.RegisterToken: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecRegisterTokenOperation(network.id, account.address, op.address));
                    break;
                }
                case OperationKind.GetCompleteAddress: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecGetCompleteAddressOperation(network.id, account.address));
                    break;
                }
                case OperationKind.SendTransaction: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(
                        new ExecSendTransactionOperation(
                            network.id,
                            account.address,
                            new FeeSettings(new CustomPaymentMethod()),
                            op.actions,
                            op.setup,
                        ),
                    );
                    break;
                }
                case OperationKind.SimulateTransaction: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(
                        new ExecSimulateTransactionOperation(
                            network.id,
                            account.address,
                            op.actions,
                            op.setup,
                            op.simulatePublic,
                        ),
                    );
                    break;
                }
                case OperationKind.SimulateUtility: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(
                        new ExecSimulateUtilityOperation(network.id, account.address, op.contract, op.method, op.args),
                    );
                    break;
                }
                case OperationKind.SimulateViews: {
                    const [network, account] = await getNetworkAndAccount(op.account);
                    operations.push(new ExecSimulateViewsOperation(network.id, account.address, op.calls));
                    break;
                }
                default: {
                    throw new Error("Invalid operation kind");
                }
            }
        }
        await this.profileService.refreshSession();
        const results = await this.executionService.executeOperations(operations, {
            type: OriginType.DAPP,
            name: payload.session.dappMetadata.name ?? "Unknown dapp",
        });
        // TODO: refactor types
        return results.map(x => x as unknown as OperationResult);
    }

    private async validateSession({ sessionId, operations }: ExecutionParams): Promise<DappSession> {
        const session = await this.dappSessionService.tryGetDappSession(sessionId);
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
            case OperationKind.RegisterToken:
                return AccessLevel.AppState;
            case OperationKind.GetCompleteAddress:
                return AccessLevel.PublicData;
            case OperationKind.RegisterContract:
                return AccessLevel.PxeState;
            case OperationKind.RegisterSender:
                return AccessLevel.PxeState;
            case OperationKind.SimulateTransaction:
                return AccessLevel.PrivateData;
            case OperationKind.SimulateUtility:
                return AccessLevel.PrivateData;
            case OperationKind.SimulateViews:
                return AccessLevel.PrivateData;
            case OperationKind.SendTransaction:
                return AccessLevel.Transactions;
            default:
                return AccessLevel.None;
        }
    }
}
