import { NoteStatus as _NoteStatus } from "@aztec/stdlib/note";
import { ILogger } from "@/wallet/logger";
import { ServiceCollection, ServiceSpec } from "@/wallet/base";
import { Service } from "@/wallet/base/background";
import { ExecutionService, FeeSettings, AuthwitContent } from "@/wallet/services/execution/service";
import { ProfileService } from "@/wallet/services/profile/service";
import { NetworkService } from "@/wallet/services/network/service";
import { AccountService } from "@/wallet/services/account/service";
import { WrappedTask } from "@/wallet/services/task/wrapped-task";
import { TaskService, RevokeAuthwitsContent, StepContent } from "@/wallet/services/task/service";
import { TransactionService, OriginType } from "@/wallet/services/transaction/service";
import { EntityStorage, StorageType } from "@/wallet/storage";
import { array_max, Lock } from "@/wallet/utils";
import { getAuthRegistryAddress, isAuthRegistryEnabled, isAuthwitConsumable } from "@/wallet/utils/auth-registry";
import { EventHandler } from "@/wallet/utils/event-handler";
import { AUTH_REGISTRY_SERVICE_NAME, Authwit, Events, MAX_REVOKES_PER_TX, Methods } from "./spec";
import { AztecNode } from "@aztec/stdlib/interfaces/client";

export * from "./spec";

export class AuthRegistryService extends Service<Methods, Events> implements ServiceSpec<Methods, Events> {
    public static name = AUTH_REGISTRY_SERVICE_NAME;

    public readonly onAuthwitAdded = new EventHandler<Authwit>();
    public readonly onAuthwitDeleted = new EventHandler<Authwit>();
    public readonly onRegistryEnabled = new EventHandler<string>();
    public readonly onRegistryDisabled = new EventHandler<string>();

    private readonly authwits = new EntityStorage<Authwit>("azguard:core:auth-registry", StorageType.Local);
    private readonly statuses = new EntityStorage<boolean>("azguard:core:auth-registry-enabled", StorageType.Local);
    private readonly lock = new Lock();

    private profileService: ProfileService = null!;
    private networkService: NetworkService = null!;
    private accountService: AccountService = null!;
    private executionService: ExecutionService = null!;
    private transactionService: TransactionService = null!;
    private taskService: TaskService = null!;

    public constructor(logger: ILogger) {
        super(AUTH_REGISTRY_SERVICE_NAME, logger);
    }

    protected async init(services: ServiceCollection) {
        this.profileService = services.get(ProfileService.name);
        this.networkService = services.get(NetworkService.name);
        this.accountService = services.get(AccountService.name);
        this.executionService = services.get(ExecutionService.name);
        this.transactionService = services.get(TransactionService.name);
        this.taskService = services.get(TaskService.name);
    }

    public async trackAuthwit(account: string, hash: string, content: AuthwitContent) {
        try {
            await this.lock.enter();
            const authwits = await this.authwits.getValues();
            if (authwits.some(x => x.account === account && x.hash === hash)) {
                return;
            }
            const nextId = array_max(authwits.map(x => x.id)) + 1;
            const authwit: Authwit = { id: nextId, account, hash, content };
            await this.authwits.set(`${authwit.id}`, authwit);
            this.emit("onAuthwitAdded", authwit);
        } finally {
            this.lock.leave();
        }
    }

    public async getAuthwits(account: string): Promise<Authwit[]> {
        return (await this.authwits.getValues()).filter(x => x.account === account);
    }

    public async revokeAuthwits(
        networkId: string,
        account: string,
        ids: number[],
        feeSettings: FeeSettings,
    ): Promise<void> {
        await this.ensureInitialized();
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
                {
                    kind: "send_transaction",
                    networkId,
                    accountAddress: account,
                    feeSettings,
                    actions: authwits.map(x => ({
                        kind: "call",
                        contract: registryAddress,
                        method: "set_authorized",
                        args: [x.hash, false],
                    })),
                },
                { type: OriginType.UI },
                task,
            );

            await this.transactionService.waitForTx(txHash, task);

            const network = await this.networkService.getNetwork(networkId);
            const node = await this.networkService.getNode(network.chainId);
            await this.syncAuthwits(node, account, task, authwits);

            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    public async getRegistryEnabled(account: string): Promise<boolean> {
        return (await this.statuses.get(account)) ?? true;
    }

    public async setRegistryEnabled(
        networkId: string,
        account: string,
        enabled: boolean,
        feeSettings: FeeSettings,
    ): Promise<void> {
        await this.ensureInitialized();
        const task = this.taskService.startNewTask(new StepContent(`${enabled ? "Enable" : "Disable"} auth registry`));
        try {
            const txHash = await this.executionService.executeSendTransaction(
                {
                    kind: "send_transaction",
                    networkId,
                    accountAddress: account,
                    feeSettings,
                    actions: [
                        {
                            kind: "call",
                            contract: getAuthRegistryAddress().toString(),
                            method: "set_reject_all",
                            args: [!enabled],
                        },
                    ],
                },
                { type: OriginType.UI },
                task,
            );

            await this.transactionService.waitForTx(txHash, task);

            const network = await this.networkService.getNetwork(networkId);
            const node = await this.networkService.getNode(network.chainId);
            await this.syncStatus(node, account, task);

            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    public async syncRegistry(networkId: string, account: string): Promise<void> {
        await this.ensureInitialized();
        const task = this.taskService.startNewTask(new StepContent("Sync auth registry"));
        try {
            const network = await this.networkService.getNetwork(networkId);
            const node = await this.networkService.getNode(network.chainId);
            await Promise.all([this.syncAuthwits(node, account, task), this.syncStatus(node, account, task)]);
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async syncAuthwits(node: AztecNode, account: string, parentTask: WrappedTask, authwits?: Authwit[]) {
        const task = parentTask.startSubtask(new StepContent("Sync authwits"));
        try {
            const _authwits = authwits ?? (await this.getAuthwits(account));
            await Promise.all(_authwits.map(authwit => this.syncAuthwit(node, authwit, task)));
            task.complete();
        } catch (error) {
            task.fail(error);
            throw error;
        }
    }

    private async syncAuthwit(node: AztecNode, authwit: Authwit, parentTask: WrappedTask) {
        const task = parentTask.startSubtask(new StepContent(`Sync authwit #${authwit.id}`));
        try {
            const isConsumable = await isAuthwitConsumable(node, authwit.account, authwit.hash);
            if (isConsumable) return;
            try {
                await this.lock.enter();
                if (await this.authwits.get(`${authwit.id}`)) {
                    await this.authwits.delete(`${authwit.id}`);
                    this.emit("onAuthwitDeleted", authwit);
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

    private async syncStatus(node: AztecNode, account: string, parentTask: WrappedTask): Promise<void> {
        const task = parentTask.startSubtask(new StepContent("Sync status"));
        try {
            const isEnabled = await isAuthRegistryEnabled(node, account);
            try {
                await this.lock.enter();
                const enabled = await this.statuses.get(account);
                if (enabled !== isEnabled) {
                    if (isEnabled) {
                        await this.statuses.delete(account);
                        this.emit("onRegistryEnabled", account);
                    } else {
                        await this.statuses.set(account, isEnabled);
                        this.emit("onRegistryDisabled", account);
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

    public async backup() {
        const profile = await this.profileService.getActiveProfile();
        if (!profile) {
            throw new Error("Profile locked");
        }

        const networks = (await this.networkService.getNetworks());
        if (!networks.length) {
            return undefined;
        }

        const authwits: Authwit[] = [];

        for (const n of networks) {
            const accounts = await this.accountService.getAccounts(profile.id, n.chainId);
            for (const acc of accounts) {
                authwits.push(...(await this.getAuthwits(acc.address)));
            }
        }

        return authwits;
    }
}
