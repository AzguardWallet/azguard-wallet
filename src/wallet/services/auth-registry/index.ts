import type { PXE } from "@aztec/stdlib/interfaces/client";
import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import type { EventMessage, RequestMessage, ResponseMessage } from "@/wallet/base/port-service/messages";
import { Service } from "@/wallet/base/port-service/service";
import { ExecutionService } from "@/wallet/services/execution";
import { CallAction, FeeSettings, IAuthwitContent, SendTransactionOperation } from "@/wallet/services/execution/client";
import type { NetworkService } from "@/wallet/services/network";
import { PxeServiceClient } from "@/wallet/services/pxe/client";
import { TaskService, WrappedTask } from "@/wallet/services/task";
import { RevokeAuthwitsContent, StepContent } from "@/wallet/services/task/client";
import { TransactionService } from "@/wallet/services/transaction";
import { OriginType, TxOrigin } from "@/wallet/services/transaction/client";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max, Lock } from "@/wallet/utils";
import { getAuthRegistryAddress, isAuthRegistryEnabled, isAuthwitConsumable } from "@/wallet/utils/auth-registry";
import {
    Authwit,
    type GetAuthwitsRequest,
    GetAuthwitsResponse,
    type RevokeAuthwitsRequest,
    RevokeAuthwitsResponse,
    type GetRegistryEnabledRequest,
    GetRegistryEnabledResponse,
    type SetRegistryEnabledRequest,
    SetRegistryEnabledResponse,
    type SyncRegistryRequest,
    SyncRegistryResponse,
    AUTH_REGISTRY_SERVICE_NAME,
    AuthRegistryServiceMethod,
    AuthRegistryServiceEvent,
    AuthRegistryServiceEventMessage,
} from "./client";

const MAX_REVOKES_PER_TX = 28; // Aztec protocol limitation

export class AuthRegistryService extends Service {
    private readonly pxeService: PxeServiceClient;
    private readonly authwits: EntityStorage<Authwit>;
    private readonly statuses: EntityStorage<boolean>;
    private readonly lock = new Lock();

    public executionService: ExecutionService = undefined as any; // TODO: implement DI

    constructor(
        private readonly networks: NetworkService,
        private readonly taskService: TaskService,
        private readonly transactionService: TransactionService,
        emit: (event: EventMessage) => void,
    ) {
        super(AUTH_REGISTRY_SERVICE_NAME, emit);
        this.pxeService = new PxeServiceClient();
        this.authwits = new EntityStorage("azguard:core:auth-registry", StorageType.Local);
        this.statuses = new EntityStorage("azguard:core:auth-registry-enabled", StorageType.Local);
    }

    public async process(request: RequestMessage): Promise<ResponseMessage | undefined> {
        switch (request.method) {
            case AuthRegistryServiceMethod.GetAuthwits: {
                const _request = request as GetAuthwitsRequest;
                try {
                    const result = await this.getAuthwits(_request.account);
                    return new GetAuthwitsResponse(_request, result);
                } catch (error: any) {
                    return new GetAuthwitsResponse(_request, undefined, error.message);
                }
            }
            case AuthRegistryServiceMethod.RevokeAuthwits: {
                const _request = request as RevokeAuthwitsRequest;
                try {
                    await this.revokeAuthwits(_request.networkId, _request.account, _request.ids, _request.feeSettings);
                    return new RevokeAuthwitsResponse(_request);
                } catch (error: any) {
                    return new RevokeAuthwitsResponse(_request, error.message);
                }
            }
            case AuthRegistryServiceMethod.GetRegistryEnabled: {
                const _request = request as GetRegistryEnabledRequest;
                try {
                    const result = await this.getRegistryEnabled(_request.account);
                    return new GetRegistryEnabledResponse(_request, result);
                } catch (error: any) {
                    return new GetRegistryEnabledResponse(_request, undefined, error.message);
                }
            }
            case AuthRegistryServiceMethod.SetRegistryEnabled: {
                const _request = request as SetRegistryEnabledRequest;
                try {
                    await this.setRegistryEnabled(
                        _request.networkId,
                        _request.account,
                        _request.enabled,
                        _request.feeSettings,
                    );
                    return new SetRegistryEnabledResponse(_request);
                } catch (error: any) {
                    return new SetRegistryEnabledResponse(_request, error.message);
                }
            }
            case AuthRegistryServiceMethod.SyncRegistry: {
                const _request = request as SyncRegistryRequest;
                try {
                    await this.syncRegistry(_request.networkId, _request.account);
                    return new SyncRegistryResponse(_request);
                } catch (error: any) {
                    return new SyncRegistryResponse(_request, error.message);
                }
            }
            default: {
                console.error(`Invalid request method ${request.method}.`);
                return undefined;
            }
        }
    }

    public async trackAuthwit(account: string, hash: string, content: IAuthwitContent) {
        try {
            await this.lock.enter();
            const authwits = await this.authwits.getValues();
            if (authwits.some(x => x.account === account && x.hash === hash)) {
                return;
            }
            const nextId = array_max(authwits.map(x => x.id)) + 1;
            const authwit = new Authwit(nextId, account, hash, content);
            await this.authwits.set(`${authwit.id}`, authwit);
            this.emit(new AuthRegistryServiceEventMessage(AuthRegistryServiceEvent.AuthwitAdded, authwit));
        } finally {
            this.lock.leave();
        }
    }

    public async getAuthwits(account: string): Promise<Authwit[]> {
        return (await this.authwits.getValues()).filter(x => x.account === account);
    }

    public async revokeAuthwits(networkId: string, account: string, ids: number[], feeSettings: FeeSettings) {
        if (ids.length > MAX_REVOKES_PER_TX) {
            throw new Error(`Cannot revoke more than ${MAX_REVOKES_PER_TX} authwits per single tx`);
        }

        const authwits = [];
        for (const id of ids) {
            const authwit = await this.authwits.get(`${id}`);
            if (!authwit) {
                throw new Error(`Authwit #${id} doesn't exist`);
            }
            authwits.push(authwit);
        }

        const task = this.taskService.startNewTask(new RevokeAuthwitsContent(ids));
        try {
            const registryAddress = getAuthRegistryAddress().toString();
            const txHash = await this.executionService.executeSendTransaction(
                new SendTransactionOperation(
                    networkId,
                    account,
                    feeSettings,
                    authwits.map(x => new CallAction(registryAddress, "set_authorized", [x.hash, false])),
                ),
                new TxOrigin(OriginType.UI),
                task,
            );

            await this.transactionService.waitForTx(txHash, task);

            const network = await this.networks.getNetwork(networkId);
            const pxe = this.pxeService.getPXE(network);
            await this.syncAuthwits(pxe, account, task, authwits);

            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    public async getRegistryEnabled(account: string): Promise<boolean> {
        return (await this.statuses.get(account)) ?? true;
    }

    public async setRegistryEnabled(networkId: string, account: string, enabled: boolean, feeSettings: FeeSettings) {
        const task = this.taskService.startNewTask(new StepContent(`${enabled ? "Enable" : "Disable"} auth registry`));
        try {
            const txHash = await this.executionService.executeSendTransaction(
                new SendTransactionOperation(networkId, account, feeSettings, [
                    new CallAction(getAuthRegistryAddress().toString(), "set_reject_all", [!enabled]),
                ]),
                new TxOrigin(OriginType.UI),
                task,
            );

            await this.transactionService.waitForTx(txHash, task);

            const network = await this.networks.getNetwork(networkId);
            const pxe = this.pxeService.getPXE(network);
            await this.syncStatus(pxe, account, task);

            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    public async syncRegistry(networkId: string, account: string): Promise<void> {
        const task = this.taskService.startNewTask(new StepContent("Sync auth registry"));
        try {
            const network = await this.networks.getNetwork(networkId);
            const pxe = this.pxeService.getPXE(network);
            await Promise.all([
                this.syncAuthwits(pxe, account, task),
                this.syncStatus(pxe, account, task),
            ]);
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async syncAuthwits(pxe: PXE, account: string, parentTask: WrappedTask, authwits?: Authwit[]) {
        const task = parentTask.startSubtask(new StepContent("Sync authwits"));
        try {
            const _authwits = authwits ?? (await this.getAuthwits(account));
            await Promise.all(
                _authwits.map(authwit => this.syncAuthwit(pxe, authwit, task)),
            );
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async syncAuthwit(pxe: PXE, authwit: Authwit, parentTask: WrappedTask) {
        const task = parentTask.createSubtask(new StepContent(`Sync authwit #${authwit.id}`));
        try {
            const isConsumable = await isAuthwitConsumable(pxe, authwit.account, authwit.hash);
            if (isConsumable) return;
            try {
                await this.lock.enter();
                if (await this.authwits.get(`${authwit.id}`)) {
                    await this.authwits.delete(`${authwit.id}`);
                    this.emit(new AuthRegistryServiceEventMessage(AuthRegistryServiceEvent.AuthwitDeleted, authwit));
                }
            } finally {
                this.lock.leave();
            }
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async syncStatus(pxe: PXE, account: string, parentTask: WrappedTask): Promise<void> {
        const task = parentTask.startSubtask(new StepContent("Sync status"));
        try {
            const isEnabled = await isAuthRegistryEnabled(pxe, account);
            try {
                await this.lock.enter();
                const enabled = await this.statuses.get(account);
                if (enabled !== isEnabled) {
                    if (isEnabled) {
                        await this.statuses.delete(account);
                        this.emit(
                            new AuthRegistryServiceEventMessage(AuthRegistryServiceEvent.RegistryEnabled, account),
                        );
                    } else {
                        await this.statuses.set(account, isEnabled);
                        this.emit(
                            new AuthRegistryServiceEventMessage(AuthRegistryServiceEvent.RegistryDisabled, account),
                        );
                    }
                }
            } finally {
                this.lock.leave();
            }
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }
}
